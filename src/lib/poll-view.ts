import { isPollClosed } from "@/lib/expiry";
import type { PollMeta, PollResults } from "@/lib/poll-types";

export function shapePollResults(
  meta: PollMeta,
  counts: Record<string, number>,
  totalVotes: number,
  optionIds: string[] | null,
  now = Date.now(),
): PollResults {
  const voted = optionIds !== null;
  return {
    poll: {
      shortCode: meta.shortCode,
      question: meta.question,
      choiceType: meta.choiceType,
      expiresAt: meta.expiresAt,
      createdAt: meta.createdAt,
      closed: isPollClosed(meta.expiresAt, now),
      options: meta.options.map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
        votes: counts[option.id] ?? 0,
      })),
    },
    totalVotes,
    updatedAt: new Date(now).toISOString(),
    voter: {
      hasVoted: voted,
      optionIds: optionIds ?? [],
    },
  };
}
