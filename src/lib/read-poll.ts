import { AppError } from "@/lib/errors";
import { readBallot, readPollCache, rebuildPollCache } from "@/lib/poll-cache";
import { shapePollResults } from "@/lib/poll-view";
import type { PollResults } from "@/lib/poll-types";
import { getPrisma } from "@/lib/prisma";
import { loadPollSnapshot } from "@/lib/snapshot";
import { voterKeyFor } from "@/lib/voter";

export async function readPollResults(
  shortCode: string,
  visitorId: string,
): Promise<PollResults> {
  let cached = await readPollCache(shortCode);

  if (cached.status !== "hit") {
    const pollId =
      cached.status === "cold"
        ? cached.pollId
        : await findPollId(shortCode);
    if (!pollId) throw new AppError(404, "NOT_FOUND", "Poll not found");

    const rebuilt = await rebuildPollCache(pollId, loadPollSnapshot);
    if (rebuilt === "missing") throw new AppError(404, "NOT_FOUND", "Poll not found");
    if (rebuilt !== "ready") {
      throw new AppError(503, "CACHE_WARMING", "Results are warming up. Retry in a moment.");
    }

    cached = await readPollCache(shortCode);
    if (cached.status !== "hit") {
      throw new AppError(503, "CACHE_WARMING", "Results are warming up. Retry in a moment.");
    }
  }

  const voterKey = await voterKeyFor(cached.meta.id, visitorId);
  const optionIds = await readBallot(cached.meta.id, voterKey);
  return shapePollResults(cached.meta, cached.counts, cached.total, optionIds);
}

async function findPollId(shortCode: string): Promise<string | null> {
  const poll = await getPrisma().poll.findUnique({
    where: { shortCode },
    select: { id: true },
  });
  return poll?.id ?? null;
}
