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
