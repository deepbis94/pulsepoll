import { describe, expect, it } from "vitest";

import type { PollResults } from "@/lib/poll-types";
import {
  applyOptimisticVote,
  barWidthPercent,
  formatVoterCount,
  optionPercent,
  selectionTotal,
} from "@/lib/results-math";

const results: PollResults = {
  poll: {
    shortCode: "abcdefgh",
    question: "Lunch?",
    choiceType: "MULTIPLE",
    expiresAt: null,
    createdAt: "2026-09-28T11:00:00.000Z",
    closed: false,
    options: [
      { id: "a", label: "Soup", position: 0, votes: 8 },
      { id: "b", label: "Salad", position: 1, votes: 6 },
      { id: "c", label: "Bread", position: 2, votes: 0 },
    ],
  },
  totalVotes: 10,
  updatedAt: "2026-09-28T12:00:00.000Z",
  voter: { hasVoted: false, optionIds: [] },
};

describe("vote counts", () => {
  it("uses ballots as the denominator, so multiple-choice bars can sum past 100", () => {
    const soup = optionPercent(8, 10);
    const salad = optionPercent(6, 10);
    expect(soup).toBe(80);
    expect(salad).toBe(60);
    expect(soup + salad).toBe(140);
    expect(selectionTotal([8, 6, 0])).toBe(14);
    expect(selectionTotal([8, 6, 0])).toBeGreaterThan(10);
  });

  it("renders an empty room as zero percent", () => {
    expect(optionPercent(0, 0)).toBe(0);
    expect(optionPercent(3, 0)).toBe(0);
    expect(formatVoterCount(0)).toBe("0 voters");
    expect(formatVoterCount(1)).toBe("1 voter");
    expect(formatVoterCount(2)).toBe("2 voters");
  });

  it("caps a bar at the full width", () => {
    expect(barWidthPercent(10, 10)).toBe(100);
    expect(barWidthPercent(12, 10)).toBe(100);
  });

  it("counts one ballot and one selection per chosen option", () => {
    const next = applyOptimisticVote(results, ["a", "c"]);
    expect(next.totalVotes).toBe(11);
    expect(next.poll.options.map((option) => option.votes)).toEqual([9, 6, 1]);
    expect(selectionTotal(next.poll.options.map((option) => option.votes))).toBe(16);
    expect(next.voter).toEqual({ hasVoted: true, optionIds: ["a", "c"] });
    expect(results.totalVotes).toBe(10);
  });
});
