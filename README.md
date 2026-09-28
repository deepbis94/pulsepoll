# PulsePoll

Live polls. A host creates a poll, shares a short link, and every connected browser watches the counts move.

Create a poll on the home page. Open `/p/[code]` to vote. Results poll every 1.5 seconds, pause while the tab is hidden, and animate between payloads.

## Engineering decisions

### Live updates

Votes are written on `POST /api/polls/[code]/votes`. The handler stores the rows in Postgres, then updates a Redis hash of per-option counts. Open browsers learn about new votes by polling `GET /api/polls/[code]` about every 1.5 seconds. The response is `Cache-Control: no-store`. The chart animates between payloads, and `updatedAt` drives the "last updated" label. The browser skips the poll while `document.visibilityState` is `hidden`.

**Server-Sent Events fed by Redis pub/sub** is the other realistic design. After each vote the API would `PUBLISH`, and each browser would hold an EventSource open. That fits a long-running process. On this stack it fights the platform:

- Upstash's HTTP client cannot `SUBSCRIBE`. Classic pub/sub needs a TCP connection that stays open. Serverless invocations are short, and the Edge runtime has no general TCP client.
- An SSE route that stays open is billed for the whole duration and dies at the function max duration. Clients reconnect in a loop that behaves like polling, with connection bookkeeping on top.
- A thousand viewers means a thousand held invocations, a cold start on each reconnect, and a thundering herd after every deploy.
- The usual workaround (the SSE handler itself polls Redis and writes to the stream) is polling moved server-side.

**Short polling is the v1 path.** A 1–2 second delay is acceptable for a poll, the handler is a normal GET, and it is straightforward to test. The write path only depends on the Redis keys, so a later SSE or websocket subscriber can read the same hash.

At roughly 1,000 concurrent viewers, a 1.5 second interval is on the order of 700 function invocations per second for one hot poll. That is the number that would justify a dedicated realtime connection. Demo traffic stays well under it.

### The cache rebuild race

Postgres is the source of truth. Redis holds `poll:{id}:counts`, `poll:{id}:total`, and `poll:{id}:applied` (the last `ballotSeq` reflected in those counts). A cache miss rebuilds the hash with `GROUP BY option_id`.

An unguarded rebuild loses votes:

1. Rebuild reads Postgres and sees 5 votes for option A.
2. A new vote commits and `HINCRBY` moves Redis to 6.
3. The rebuild writes its snapshot of 5 over the 6.

The inverse also loses a vote: the snapshot already includes a ballot, and a late `HINCRBY` counts it again.

`Poll.ballotSeq` is the fence. It increments in the same transaction as the vote insert, and that value is stored on the vote rows. All Redis count mutations go through Lua, so the compare and the write cannot interleave.

- **Incremental apply** runs only when the cache is warm and `ballotSeq === applied + 1`. It then `HINCRBY`s each chosen option, increments the ballot total by 1, and sets `applied` to that seq. If `ballotSeq <= applied`, the snapshot already contains the ballot and the script does not increment. If the seq skips ahead, the script returns a gap and the caller rebuilds.
- **Snapshot commit** holds a short lock (`SET NX EX`). It writes the absolute counts only when `applied <= snapshotSeq`. If incremental updates have already moved past the snapshot, the script leaves them in place and drops the lock.

Concrete overlap:

1. Cache is warm at seq 4.
2. Rebuild reads Postgres. The new ballot (seq 5) is already committed, so the snapshot total is 5.
3. Apply runs first: `applied` was 4, so it increments to 5. The counts are correct.
4. Commit sees `applied === 5` and `snapshotSeq === 5`. Overwriting with the snapshot stores the same numbers.
5. If commit runs first, it sets `applied` to 5 from the snapshot. Apply then sees `seq <= applied` and does not increment.

A stale snapshot (seq 4) that finishes after apply has moved to 5 is refused, because `applied > snapshotSeq`. The incremental counts stay.

A cold cache does not increment from zero. Apply returns "cold", and the rebuild writes the full snapshot, including the ballot that just committed.

### Where the polled GET runs

The warm GET only needs Upstash's REST API: poll metadata, the count hash, the total, and this visitor's ballot. That would be a natural Edge route.

Next.js 16 deprecates `export const runtime = 'edge'` and tells you to remove it in favor of the Node.js runtime. Shipping the deprecated option would warn on every build, so the GET stays on Node. The warm path still does not query Postgres. A miss loads a snapshot from Postgres in the same process and commits it through the Lua fence. There is no second HTTP hop and no shared rebuild secret.

Prisma is the other hard stop for Edge. The client uses a Node Postgres driver (`pg`). Putting that query on the Edge runtime would mean a fetch-based driver such as Neon's, which we do not need while the handler is on Node.

### Voter state on GET

`GET /api/polls/[code]` returns the poll, per-option counts, `totalVotes`, `updatedAt`, and:

```json
{ "voter": { "hasVoted": true, "optionIds": ["..."] } }
```

The visitor id lives in an HttpOnly cookie, `pp_vid`. The stored key is `sha256(pollId + ":" + visitorId)`, so the raw cookie is not in Postgres and the same browser does not share a key across polls. The ballot key in Redis holds the option ids from the submission. A reload can show results instead of the voting form without another write.

`totalVotes` counts ballots (one per voter). `options[].votes` counts selections. On a multiple-choice poll the bars can sum above `totalVotes`, and each bar's percentage is selections divided by ballots.

If Redis is flushed, the GET can forget a ballot until the next vote attempt hits the unique index and the handler writes the ballot key again. The database remains the backstop.

### Rate limits

Both limits use Upstash's sliding window, keyed by a hash of the client IP. On Vercel the platform sets `x-forwarded-for`. If the limiter times out or errors, the route fails closed with 503.

| Route | Limit |
| --- | --- |
| `POST /api/polls` | 10 creations per hour per IP |
| `POST /api/polls/[code]/votes` | 30 attempts per minute per IP per poll |

The vote limit is per poll so one busy room does not block someone creating or voting elsewhere. It is deliberately not a unique constraint on IP. Carrier-grade NAT would turn that into silent vote loss. The cookie, the Redis ballot lock, and the database unique index are what stop double voting.

### Data model

| Index | Role |
| --- | --- |
| `Poll.shortCode` unique | Every page and API lookup. |
| `Option (pollId, position)` unique | Options for a poll in display order. The leftmost column covers `WHERE pollId = ?`. |
| `Vote (pollId, voterKey, optionId)` unique | One row per selected option, and the durable double-vote check. The `pollId` prefix serves poll-scoped counts. |
| `Vote (pollId, ballotSeq, optionId)` unique | Ties each row to the fencing token for that submission. |
| `Vote.optionId` | Postgres does not index foreign keys on its own. Cascade deletes need this. |

A vote row points at both the option and the poll. Live results are `WHERE poll_id = ? GROUP BY option_id`, and "has this visitor already voted?" is a predicate on `(pollId, voterKey)`. Neither query should have to join through `Option` to find the poll. Counts are not denormalized onto `Option`; Redis is the cache and can be rebuilt from the group-by.

`expiresAt` is not indexed. Expiry is checked on the single poll already loaded by `shortCode`.

### Double voting

One POST is one ballot: a single option, or several on a multiple-choice poll. A second submission is rejected.

1. `SET ballot:{pollId}:{voterKey} NX EX 30` so two tabs cannot both pass a read-then-write check. The TTL is extended after the database transaction commits. A crash in between only locks the visitor for 30 seconds.
2. Inside one transaction, the poll row is updated only if it is still open (`ballotSeq` increments under that row lock), then the vote rows are inserted.
3. The unique index on `(pollId, voterKey, optionId)` rejects a duplicate if the Redis key has expired and the vote is still in Postgres.

Clearing cookies or switching browsers creates a new voter. That is the accepted gap for an anonymous poll. Accounts or device fingerprints cost privacy and still lose to a determined user.

## Live demo

Production URL: _add the Vercel URL here after deploy._

Until that hostname is filled in, run the app locally with the steps below.

## Screenshots

Capture these on a phone-width viewport after deploy and commit them under `docs/screenshots/`.

1. **Create** — `docs/screenshots/create.png` — home page form, including option rows and the duration control.
2. **Vote** — `docs/screenshots/vote.png` — open poll with vote buttons.
3. **Results** — `docs/screenshots/results.png` — animated bars, the voter count, and the last-updated line.

## Deploy

The production target is Vercel, with Upstash Redis and hosted Postgres (Neon or Supabase).

Set these environment variables on the Vercel project:

- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

`npm run build` is the build command. `postinstall` generates the Prisma client. Apply migrations to the production database with `npx prisma migrate deploy` before the first real poll.

After the deployment is up, replace the live demo URL and add the three screenshots above.

## Local development

```bash
cp .env.example .env
# fill DATABASE_URL and the Upstash REST credentials

npx prisma migrate dev
npm run dev
```

`ballotSeq` starts at 0. Creating a poll writes the read model into Redis. If that write fails, the first GET rebuilds it from Postgres.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:migrate` | Create and apply a Prisma migration |
| `npm run db:generate` | Regenerate the Prisma client |
