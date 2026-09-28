import { rateLimitMessage, readApiError } from "@/lib/api-error";
import { isPollResults, type PollResults } from "@/lib/poll-types";
import type { CreatePollInput } from "@/lib/validators";

export const POLL_INTERVAL_MS = 1500;

export class PollClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly voter?: {
    hasVoted: boolean;
    optionIds: string[];
  };

  constructor(
    status: number,
    code: string,
    message: string,
    voter?: { hasVoted: boolean; optionIds: string[] },
  ) {
    super(message);
    this.name = "PollClientError";
    this.status = status;
    this.code = code;
    this.voter = voter;
  }
}

export async function fetchPoll(code: string): Promise<PollResults> {
  const response = await fetch(`/api/polls/${code}`, { cache: "no-store" });
  const body = await readBody(response);
  if (response.ok && isPollResults(body)) return body;
  throw errorFrom(response, body, "Could not load this poll");
}

export async function submitVote(code: string, optionIds: string[]): Promise<PollResults> {
  const response = await fetch(`/api/polls/${code}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionIds }),
  });
  const body = await readBody(response);
  if (response.ok && isPollResults(body)) return body;
  throw errorFrom(response, body, "Could not record your vote");
}

export async function createPollRequest(
  input: CreatePollInput,
): Promise<{ shortCode: string; path: string }> {
  const response = await fetch("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);
  if (response.ok && isCreatedPoll(body)) return body;
  throw errorFrom(response, body, "Could not create this poll");
}

function isCreatedPoll(value: unknown): value is { shortCode: string; path: string } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.shortCode === "string" && typeof record.path === "string";
}

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorFrom(response: Response, body: unknown, fallback: string): PollClientError {
  const apiError = readApiError(body);
  const message =
    response.status === 429
      ? rateLimitMessage(response, apiError?.error ?? "Too many attempts. Try again shortly.")
      : (apiError?.error ?? fallback);
  return new PollClientError(response.status, apiError?.code ?? "UNKNOWN", message, apiError?.voter);
}
