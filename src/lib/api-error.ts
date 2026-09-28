export type ApiErrorBody = {
  error: string;
  code: string;
  voter?: {
    hasVoted: boolean;
    optionIds: string[];
  };
};

export function readApiError(value: unknown): ApiErrorBody | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.error !== "string" || typeof record.code !== "string") return null;

  const voter = readVoter(record.voter);
  if (voter) return { error: record.error, code: record.code, voter };
  return { error: record.error, code: record.code };
}

function readVoter(value: unknown): ApiErrorBody["voter"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.hasVoted !== "boolean" || !Array.isArray(record.optionIds)) return undefined;
  if (!record.optionIds.every((id) => typeof id === "string")) return undefined;
  return { hasVoted: record.hasVoted, optionIds: record.optionIds };
}

export function rateLimitMessage(response: Response, fallback: string): string {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return `Too many attempts. Try again in ${retryAfter}s.`;
  }
  return fallback;
}
