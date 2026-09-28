import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";

import { hashClientIp } from "@/lib/ip";
import { jsonError } from "@/lib/http";
import { getRedis } from "@/lib/redis";

let createLimiter: Ratelimit | undefined;
let voteLimiter: Ratelimit | undefined;

function createPollLimiter() {
  createLimiter ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:create",
    analytics: false,
    timeout: 1500,
  });
  return createLimiter;
}

function votePollLimiter() {
  voteLimiter ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:vote",
    analytics: false,
    timeout: 1500,
  });
  return voteLimiter;
}

async function enforce(
  limiter: Ratelimit,
  identifier: string,
): Promise<NextResponse | null> {
  try {
    const result = await limiter.limit(identifier);
    await result.pending;

    if (result.reason === "timeout") {
      return jsonError(
        503,
        "RATE_LIMIT_UNAVAILABLE",
        "Rate limiter is unavailable. Try again shortly.",
      );
    }

    if (result.success) return null;

    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return jsonError(429, "RATE_LIMITED", "Too many requests. Try again shortly.", {
      "Retry-After": String(retryAfter),
    });
  } catch (error) {
    console.error(error);
    return jsonError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "Rate limiter is unavailable. Try again shortly.",
    );
  }
}

export async function enforceCreateLimit(request: Request) {
  const ipHash = await hashClientIp(request);
  return enforce(createPollLimiter(), ipHash);
}

export async function enforceVoteLimit(request: Request, shortCode: string) {
  const ipHash = await hashClientIp(request);
  return enforce(votePollLimiter(), `${ipHash}:${shortCode}`);
}
