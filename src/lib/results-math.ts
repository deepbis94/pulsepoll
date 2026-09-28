import type { PollResults } from "@/lib/poll-types";

/** Selections divided by ballots. A multiple-choice poll can sum above 100. */
export function optionPercent(selections: number, ballots: number): number {
  if (ballots <= 0 || selections <= 0) return 0;
  return (selections / ballots) * 100;
}

export function barWidthPercent(selections: number, ballots: number): number {
  return Math.min(100, optionPercent(selections, ballots));
}

export function formatPercent(selections: number, ballots: number): string {
  return `${Math.round(optionPercent(selections, ballots))}%`;
}

export function formatVoterCount(ballots: number): string {
  if (ballots === 1) return "1 voter";
  return `${ballots} voters`;
}

export function selectionTotal(counts: readonly number[]): number {
  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * One submission is one ballot, even when it selects several options.
 * Each selected option gains one selection.
 */
export function applyOptimisticVote(results: PollResults, optionIds: string[]): PollResults {
  const selected = new Set(optionIds);
  return {
    ...results,
    totalVotes: results.totalVotes + 1,
    updatedAt: new Date().toISOString(),
    voter: { hasVoted: true, optionIds: [...optionIds] },
    poll: {
      ...results.poll,
      options: results.poll.options.map((option) =>
        selected.has(option.id) ? { ...option, votes: option.votes + 1 } : option,
      ),
    },
  };
}

export function formatLastUpdated(iso: string, now: number): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "Updated just now";
  const seconds = Math.max(0, Math.floor((now - parsed) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}
