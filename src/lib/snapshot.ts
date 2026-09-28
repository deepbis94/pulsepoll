import { getPrisma } from "@/lib/prisma";
import type { PollSnapshot } from "@/lib/poll-types";

export async function loadPollSnapshot(pollId: string): Promise<PollSnapshot | null> {
  const prisma = getPrisma();
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!poll) return null;

  const grouped = await prisma.vote.groupBy({
    by: ["optionId"],
    where: { pollId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const option of poll.options) counts[option.id] = 0;
  for (const row of grouped) counts[row.optionId] = row._count._all;

  return {
    meta: {
      id: poll.id,
      shortCode: poll.shortCode,
      question: poll.question,
      choiceType: poll.choiceType,
      expiresAt: poll.expiresAt?.toISOString() ?? null,
      createdAt: poll.createdAt.toISOString(),
      options: poll.options.map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
      })),
    },
    ballotSeq: poll.ballotSeq,
    total: poll.ballotSeq,
    counts,
  };
}

export async function findVoterOptionIds(
  pollId: string,
  voterKey: string,
): Promise<string[]> {
  const rows = await getPrisma().vote.findMany({
    where: { pollId, voterKey },
    select: { optionId: true },
    orderBy: { optionId: "asc" },
  });
  return rows.map((row) => row.optionId);
}
