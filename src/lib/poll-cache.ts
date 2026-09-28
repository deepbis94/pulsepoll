import { redisKeys } from "@/lib/keys";
import { asInt } from "@/lib/numbers";
import { isPollMeta, type PollMeta, type PollSnapshot } from "@/lib/poll-types";
import { getRedis } from "@/lib/redis";

/**
 * Count cache fence.
 *
 * A vote applies an incremental HINCRBY only when Redis is warm and
 * `ballotSeq === applied + 1`. A rebuild writes an absolute snapshot only
 * when `applied <= snapshotSeq`. If a vote lands in both the snapshot and
 * an incremental update, one of the two writes refuses:
 *
 * - snapshot already contains the ballot (`seq <= applied`) → skip HINCRBY
 * - incremental updates moved past the snapshot (`applied > snapshotSeq`) →
 *   do not overwrite the hash
 *
 * Redis runs each script atomically, so the compare and the write cannot interleave.
 */

const INIT_CACHE = `
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[2])
redis.call('DEL', KEYS[3])
for i = 3, #ARGV do
  redis.call('HSET', KEYS[3], ARGV[i], '0')
end
redis.call('SET', KEYS[4], '0')
redis.call('SET', KEYS[5], '0')
redis.call('SET', KEYS[6], '1')
return 1
`;

const ACQUIRE_LOCK = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then
  return 1
end
return 0
`;

const RELEASE_LOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const COMMIT_SNAPSHOT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end

local applied = redis.call('GET', KEYS[2])
local snapshotSeq = tonumber(ARGV[2])
if applied ~= false and tonumber(applied) > snapshotSeq then
  redis.call('DEL', KEYS[1])
  return -1
end

redis.call('DEL', KEYS[3])
local i = 6
while i + 1 <= #ARGV do
  redis.call('HSET', KEYS[3], ARGV[i], ARGV[i + 1])
  i = i + 2
end

redis.call('SET', KEYS[4], ARGV[3])
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[5], '1')
redis.call('SET', KEYS[6], ARGV[4])
redis.call('SET', KEYS[7], ARGV[5])
redis.call('DEL', KEYS[1])
return 1
`;

const APPLY_VOTE = `
if redis.call('GET', KEYS[1]) ~= '1' then
  return 0
end
if redis.call('EXISTS', KEYS[2]) == 0 or redis.call('EXISTS', KEYS[3]) == 0 or redis.call('EXISTS', KEYS[4]) == 0 then
  return 0
end

local applied = tonumber(redis.call('GET', KEYS[2]))
local seq = tonumber(ARGV[1])
if applied == nil or seq == nil then
  return 0
end
if seq <= applied then
  return 2
end
if seq ~= applied + 1 then
  return 3
end

for i = 2, #ARGV do
  redis.call('HINCRBY', KEYS[3], ARGV[i], 1)
end
redis.call('INCRBY', KEYS[4], 1)
redis.call('SET', KEYS[2], ARGV[1])
return 1
`;

function createScripts() {
  const redis = getRedis();
  return {
    init: redis.createScript<number>(INIT_CACHE),
    acquire: redis.createScript<number>(ACQUIRE_LOCK),
    release: redis.createScript<number>(RELEASE_LOCK),
    commit: redis.createScript<number>(COMMIT_SNAPSHOT),
    apply: redis.createScript<number>(APPLY_VOTE),
  };
}

let scripts: ReturnType<typeof createScripts> | undefined;

function getScripts() {
  scripts ??= createScripts();
  return scripts;
}

function scriptCode(value: unknown, label: string): number {
  const parsed = asInt(value);
  if (parsed === null) {
    throw new Error(`Unexpected ${label} result`);
  }
  return parsed;
}

export type CacheRead =
  | { status: "miss" }
  | { status: "cold"; pollId: string }
  | {
      status: "hit";
      meta: PollMeta;
      counts: Record<string, number>;
      total: number;
    };

export async function initPollCache(meta: PollMeta): Promise<void> {
  const optionIds = meta.options.map((option) => option.id);
  await getScripts().init.eval(
    [
      redisKeys.meta(meta.id),
      redisKeys.code(meta.shortCode),
      redisKeys.counts(meta.id),
      redisKeys.total(meta.id),
      redisKeys.appliedSeq(meta.id),
      redisKeys.warm(meta.id),
    ],
    [JSON.stringify(meta), meta.id, ...optionIds],
  );
}

export async function readPollCache(shortCode: string): Promise<CacheRead> {
  const redis = getRedis();
  const pollId = await redis.get<string>(redisKeys.code(shortCode));
  if (typeof pollId !== "string" || pollId.length === 0) return { status: "miss" };

  const [meta, warm, counts, total] = await Promise.all([
    redis.get<unknown>(redisKeys.meta(pollId)),
    redis.get<unknown>(redisKeys.warm(pollId)),
    redis.hgetall<Record<string, unknown>>(redisKeys.counts(pollId)),
    redis.get<unknown>(redisKeys.total(pollId)),
  ]);

  if (!isPollMeta(meta)) return { status: "miss" };

  const warmOk = warm === 1 || warm === "1";
  const totalVotes = asInt(total);
  const normalized = counts ? normalizeCounts(counts) : null;
  const countsCoverOptions =
    normalized !== null &&
    meta.options.every((option) => normalized[option.id] !== undefined);

  if (!warmOk || totalVotes === null || !countsCoverOptions || !normalized) {
    return { status: "cold", pollId };
  }

  return { status: "hit", meta, counts: normalized, total: totalVotes };
}

function normalizeCounts(raw: Record<string, unknown>): Record<string, number> | null {
  const counts: Record<string, number> = {};
  for (const [optionId, value] of Object.entries(raw)) {
    const count = asInt(value);
    if (count === null || count < 0) return null;
    counts[optionId] = count;
  }
  return counts;
}

export type ApplyVoteResult = "applied" | "included" | "cold" | "gap";

export async function applyVoteCounts(
  pollId: string,
  ballotSeq: number,
  optionIds: string[],
): Promise<ApplyVoteResult> {
  const code = scriptCode(
    await getScripts().apply.eval(
      [
        redisKeys.warm(pollId),
        redisKeys.appliedSeq(pollId),
        redisKeys.counts(pollId),
        redisKeys.total(pollId),
      ],
      [String(ballotSeq), ...optionIds],
    ),
    "apply",
  );

  if (code === 1) return "applied";
  if (code === 2) return "included";
  if (code === 3) return "gap";
  return "cold";
}

const REBUILD_LOCK_SECONDS = "15";
const REBUILD_ATTEMPTS = 3;

export async function rebuildPollCache(
  pollId: string,
  loadSnapshot: (pollId: string) => Promise<PollSnapshot | null>,
): Promise<"ready" | "missing" | "busy"> {
  for (let attempt = 0; attempt < REBUILD_ATTEMPTS; attempt += 1) {
    const token = crypto.randomUUID();
    const acquired = scriptCode(
      await getScripts().acquire.eval(
        [redisKeys.rebuildLock(pollId)],
        [token, REBUILD_LOCK_SECONDS],
      ),
      "acquire",
    );

    if (acquired !== 1) {
      await delay(40 * (attempt + 1));
      continue;
    }

    try {
      const snapshot = await loadSnapshot(pollId);
      if (!snapshot) return "missing";

      const committed = scriptCode(
        await getScripts().commit.eval(
          [
            redisKeys.rebuildLock(pollId),
            redisKeys.appliedSeq(pollId),
            redisKeys.counts(pollId),
            redisKeys.total(pollId),
            redisKeys.warm(pollId),
            redisKeys.meta(pollId),
            redisKeys.code(snapshot.meta.shortCode),
          ],
          [
            token,
            String(snapshot.ballotSeq),
            String(snapshot.total),
            JSON.stringify(snapshot.meta),
            snapshot.meta.id,
            ...countArgs(snapshot.counts),
          ],
        ),
        "commit",
      );

      if (committed === 1 || committed === -1) return "ready";
    } finally {
      await getScripts().release.eval([redisKeys.rebuildLock(pollId)], [token]);
    }
  }

  return "busy";
}

function countArgs(counts: Record<string, number>): string[] {
  const args: string[] = [];
  for (const [optionId, count] of Object.entries(counts)) {
    args.push(optionId, String(count));
  }
  return args;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readBallot(
  pollId: string,
  voterKey: string,
): Promise<string[] | null> {
  const value = await getRedis().get<unknown>(redisKeys.ballot(pollId, voterKey));
  return parseBallot(value);
}

export async function claimBallot(
  pollId: string,
  voterKey: string,
  optionIds: string[],
  ttlSeconds: number,
): Promise<boolean> {
  const result = await getRedis().set(redisKeys.ballot(pollId, voterKey), optionIds, {
    nx: true,
    ex: ttlSeconds,
  });
  return result !== null;
}

export async function storeBallot(
  pollId: string,
  voterKey: string,
  optionIds: string[],
  ttlSeconds: number,
): Promise<void> {
  await getRedis().set(redisKeys.ballot(pollId, voterKey), optionIds, {
    ex: ttlSeconds,
  });
}

export async function releaseBallot(pollId: string, voterKey: string): Promise<void> {
  await getRedis().del(redisKeys.ballot(pollId, voterKey));
}

function parseBallot(value: unknown): string[] | null {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}
