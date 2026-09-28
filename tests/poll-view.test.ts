import { describe, expect, it } from "vitest";

import { shapePollResults } from "@/lib/poll-view";
import type { PollMeta } from "@/lib/poll-types";

const now = Date.parse("2026-09-28T12:00:00.000Z");

const meta: PollMeta = {
  id: "poll_1",
  shortCode: "abcdefgh",
  question: "Lunch?",
  choiceType: "SINGLE",
  expiresAt: null,
  createdAt: "2026-09-28T11:00:00.000Z",
  options: [
    { id: "a", label: "Soup", position: 0 },
    { id: "b", label: "Salad", position: 1 },
  ],
};

describe("shapePollResults", () => {
  it("treats a missing ballot as not voted and fills unknown counts with zero", () => {
    const view = shapePollResults(meta, { a: 2 }, 3, null, now);

    expect(view.voter).toEqual({ hasVoted: false, optionIds: [] });
    expect(view.totalVotes).toBe(3);
    expect(view.poll.options).toEqual([
      { id: "a", label: "Soup", position: 0, votes: 2 },
      { id: "b", label: "Salad", position: 1, votes: 0 },
    ]);
    expect(view.poll.closed).toBe(false);
    expect(view.updatedAt).toBe("2026-09-28T12:00:00.000Z");
  });

  it("keeps the options a voter already chose", () => {
    const view = shapePollResults(meta, { a: 1 }, 1, ["a"], now);
    expect(view.voter).toEqual({ hasVoted: true, optionIds: ["a"] });
  });

  it("marks the poll closed when expiresAt is in the past", () => {
    const view = shapePollResults(
      { ...meta, expiresAt: "2026-09-28T11:59:00.000Z" },
      {},
      0,
      null,
      now,
    );
    expect(view.poll.closed).toBe(true);
  });
});
