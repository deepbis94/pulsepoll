export type ChoiceType = "SINGLE" | "MULTIPLE";

export type PollOptionMeta = {
  id: string;
  label: string;
  position: number;
};

export type PollMeta = {
  id: string;
  shortCode: string;
  question: string;
  choiceType: ChoiceType;
  expiresAt: string | null;
  createdAt: string;
  options: PollOptionMeta[];
};

export type PollSnapshot = {
  meta: PollMeta;
  ballotSeq: number;
  total: number;
  counts: Record<string, number>;
};

export type PollResults = {
  poll: {
    shortCode: string;
    question: string;
    choiceType: ChoiceType;
    expiresAt: string | null;
    createdAt: string;
    closed: boolean;
    options: Array<{
      id: string;
      label: string;
      position: number;
      votes: number;
    }>;
  };
  /** Submissions. One per voter. Option votes are selections. */
  totalVotes: number;
  updatedAt: string;
  voter: {
    hasVoted: boolean;
    optionIds: string[];
  };
};

export function isPollMeta(value: unknown): value is PollMeta {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.shortCode === "string" &&
    typeof record.question === "string" &&
    (record.choiceType === "SINGLE" || record.choiceType === "MULTIPLE") &&
    (record.expiresAt === null || typeof record.expiresAt === "string") &&
    typeof record.createdAt === "string" &&
    Array.isArray(record.options) &&
    record.options.every(isPollOptionMeta)
  );
}

export function isPollResults(value: unknown): value is PollResults {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!record.poll || typeof record.poll !== "object") return false;
  if (!record.voter || typeof record.voter !== "object") return false;
  if (typeof record.totalVotes !== "number" || typeof record.updatedAt !== "string") return false;

  const poll = record.poll as Record<string, unknown>;
  const voter = record.voter as Record<string, unknown>;
  return (
    typeof poll.shortCode === "string" &&
    typeof poll.question === "string" &&
    (poll.choiceType === "SINGLE" || poll.choiceType === "MULTIPLE") &&
    (poll.expiresAt === null || typeof poll.expiresAt === "string") &&
    typeof poll.createdAt === "string" &&
    typeof poll.closed === "boolean" &&
    Array.isArray(poll.options) &&
    poll.options.every(isResultOption) &&
    typeof voter.hasVoted === "boolean" &&
    Array.isArray(voter.optionIds) &&
    voter.optionIds.every((id) => typeof id === "string")
  );
}

function isResultOption(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.position === "number" &&
    typeof record.votes === "number"
  );
}

function isPollOptionMeta(value: unknown): value is PollOptionMeta {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.position === "number" &&
    Number.isInteger(record.position)
  );
}
