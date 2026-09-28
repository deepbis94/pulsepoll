import { ballotTtlSeconds, isPollClosed } from "@/lib/expiry";
import { AppError } from "@/lib/errors";
import {
  applyVoteCounts,
  claimBallot,
  readBallot,
  readPollCache,
  rebuildPollCache,
  releaseBallot,
  storeBallot,
} from "@/lib/poll-cache";
import { shapePollResults } from "@/lib/poll-view";
import type { PollResults } from "@/lib/poll-types";
import { getPrisma } from "@/lib/prisma";
import { findVoterOptionIds, loadPollSnapshot } from "@/lib/snapshot";
import type { CastVoteInput } from "@/lib/validators";
import { voterKeyFor } from "@/lib/voter";

const PENDING_BALLOT_SECONDS = 30;

export async function castVote(
  shortCode: string,
  visitorId: string,
  input: CastVoteInput,
): Promise<PollResults> {
  const poll = await getPrisma().poll.findUnique({
    where: { shortCode },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!poll) throw new AppError(404, "NOT_FOUND", "Poll not found");
  if (isPollClosed(poll.expiresAt, Date.now())) {
    throw new AppError(409, "POLL_CLOSED", "This poll is closed");
  }

  const optionIds = uniqueOptionIds(input.optionIds);
  if (poll.choiceType === "SINGLE" && optionIds.length !== 1) {
    throw new AppError(400, "INVALID_SELECTION", "Choose one option");
  }

  const allowed = new Set(poll.options.map((option) => option.id));
  if (optionIds.some((optionId) => !allowed.has(optionId))) {
    throw new AppError(400, "INVALID_SELECTION", "Unknown option");
  }

  const voterKey = await voterKeyFor(poll.id, visitorId);
  const claimed = await claimBallot(
    poll.id,
    voterKey,
    optionIds,
    PENDING_BALLOT_SECONDS,
  );
  if (!claimed) {
    const existing = await findVoterOptionIds(poll.id, voterKey);
    const cached = await readBallot(poll.id, voterKey);
    throw alreadyVoted(existing.length > 0 ? existing : (cached ?? []));
  }

  let ballotSeq: number;
  try {
    ballotSeq = await insertBallot(poll.id, voterKey, optionIds);
  } catch (error) {
    if (error instanceof AppError && error.code === "ALREADY_VOTED") {
      const existing = await findVoterOptionIds(poll.id, voterKey);
      await storeBallot(
        poll.id,
        voterKey,
        existing,
        ballotTtlSeconds(poll.expiresAt),
      );
      throw alreadyVoted(existing);
    }

    await releaseBallot(poll.id, voterKey);
    throw error;
  }

  await storeBallot(poll.id, voterKey, optionIds, ballotTtlSeconds(poll.expiresAt));
  try {
    await syncCounts(poll.id, ballotSeq, optionIds);
  } catch (error) {
    console.error("Count sync failed", error);
  }
  return readResults(shortCode, poll.id, voterKey, optionIds);
}

async function insertBallot(
  pollId: string,
  voterKey: string,
  optionIds: string[],
): Promise<number> {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const updated = await tx.poll.updateMany({
        where: {
          id: pollId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: { ballotSeq: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new AppError(409, "POLL_CLOSED", "This poll is closed");
      }

      const existing = await tx.vote.findFirst({
        where: { pollId, voterKey },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(409, "ALREADY_VOTED", "You already voted");
      }

      const current = await tx.poll.findUniqueOrThrow({
        where: { id: pollId },
        select: { ballotSeq: true },
      });

      await tx.vote.createMany({
        data: optionIds.map((optionId) => ({
          pollId,
          optionId,
          voterKey,
          ballotSeq: current.ballotSeq,
        })),
      });

      return current.ballotSeq;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      throw new AppError(409, "ALREADY_VOTED", "You already voted");
    }
    throw error;
  }
}

async function syncCounts(pollId: string, ballotSeq: number, optionIds: string[]) {
  let outcome = await applyVoteCounts(pollId, ballotSeq, optionIds);
  if (outcome === "gap") {
    await delay(25);
    outcome = await applyVoteCounts(pollId, ballotSeq, optionIds);
  }
  if (outcome === "cold" || outcome === "gap") {
    const rebuilt = await rebuildPollCache(pollId, loadPollSnapshot);
    if (rebuilt === "busy") {
      throw new AppError(503, "CACHE_WARMING", "Results are warming up. Retry in a moment.");
    }
  }
}

async function readResults(
  shortCode: string,
  pollId: string,
  voterKey: string,
  optionIds: string[],
): Promise<PollResults> {
  try {
    const cached = await readPollCache(shortCode);
    if (cached.status === "hit") {
      return shapePollResults(cached.meta, cached.counts, cached.total, optionIds);
    }
  } catch (error) {
    console.error(error);
  }

  const snapshot = await loadPollSnapshot(pollId);
  if (!snapshot) throw new AppError(404, "NOT_FOUND", "Poll not found");
  const stored = await findVoterOptionIds(pollId, voterKey);
  return shapePollResults(
    snapshot.meta,
    snapshot.counts,
    snapshot.total,
    stored.length > 0 ? stored : optionIds,
  );
}

function uniqueOptionIds(optionIds: string[]): string[] {
  const unique = [...new Set(optionIds)];
  if (unique.length !== optionIds.length) {
    throw new AppError(400, "INVALID_SELECTION", "Duplicate option");
  }
  return unique;
}

function alreadyVoted(optionIds: string[]) {
  return new AppError(409, "ALREADY_VOTED", "You already voted", {
    voter: { hasVoted: true, optionIds },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
