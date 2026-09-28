import { describe, expect, it } from "vitest";

import { ballotTtlSeconds, formatPollTiming, isPollClosed } from "@/lib/expiry";

const now = Date.parse("2026-09-28T12:00:00.000Z");

describe("isPollClosed", () => {
  it("stays open when there is no expiry", () => {
    expect(isPollClosed(null, now)).toBe(false);
  });

  it("stays open before expiresAt", () => {
    expect(isPollClosed("2026-09-28T12:01:00.000Z", now)).toBe(false);
  });

  it("closes at the exact expiry instant", () => {
    expect(isPollClosed("2026-09-28T12:00:00.000Z", now)).toBe(true);
    expect(isPollClosed(new Date(now), now)).toBe(true);
  });

  it("ignores an unparseable timestamp", () => {
    expect(isPollClosed("not-a-date", now)).toBe(false);
  });
});

describe("ballotTtlSeconds", () => {
  it("keeps an open-ended ballot for 30 days", () => {
    expect(ballotTtlSeconds(null, now)).toBe(30 * 86_400);
  });

  it("keeps a ballot until a day after the poll closes", () => {
    const expiresAt = new Date("2026-09-28T12:10:00.000Z");
    expect(ballotTtlSeconds(expiresAt, now)).toBe(600 + 86_400);
  });
});

describe("formatPollTiming", () => {
  it("describes a short remaining window in minutes", () => {
    expect(formatPollTiming("2026-09-28T12:10:00.000Z", now)).toBe("Closes in 10m");
  });

  it("says closed once the window has passed", () => {
    expect(formatPollTiming("2026-09-28T11:00:00.000Z", now)).toBe("Closed");
  });
});
