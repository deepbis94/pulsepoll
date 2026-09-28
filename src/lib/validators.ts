import { z } from "zod";

export const MAX_QUESTION_LENGTH = 280;
export const MAX_OPTION_LENGTH = 120;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
export const MAX_DURATION_MINUTES = 60 * 24 * 30;

const optionList = z
  .array(z.string().max(200))
  .max(20)
  .transform((options) =>
    options.map((option) => option.trim()).filter((option) => option.length > 0),
  )
  .pipe(
    z
      .array(
        z
          .string()
          .min(1, "Option text is required")
          .max(MAX_OPTION_LENGTH, "Options must be 120 characters or fewer"),
      )
      .min(MIN_OPTIONS, "Add at least 2 options")
      .max(MAX_OPTIONS, "A poll can have at most 10 options"),
  );

export const createPollSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(MAX_QUESTION_LENGTH, "Question must be 280 characters or fewer"),
  options: optionList,
  choiceType: z.enum(["SINGLE", "MULTIPLE"]).default("SINGLE"),
  durationMinutes: z
    .number("Duration must be a whole number of minutes")
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(MAX_DURATION_MINUTES, "Duration cannot exceed 30 days")
    .optional(),
});

export const castVoteSchema = z.object({
  optionIds: z
    .array(z.string().trim().min(1))
    .min(1, "Choose an option")
    .max(MAX_OPTIONS, "Too many options"),
});

export type CreatePollInput = z.output<typeof createPollSchema>;
export type CastVoteInput = z.output<typeof castVoteSchema>;

export type CreatePollFormValues = {
  question: string;
  options: string[];
  choiceType: "SINGLE" | "MULTIPLE";
  durationMinutes: string;
};

export function parseCreatePollForm(input: CreatePollFormValues) {
  const duration = input.durationMinutes.trim();
  const durationMinutes =
    duration === "" ? undefined : /^\d+$/.test(duration) ? Number(duration) : Number.NaN;

  return createPollSchema.safeParse({
    question: input.question,
    options: input.options,
    choiceType: input.choiceType,
    ...(durationMinutes === undefined ? {} : { durationMinutes }),
  });
}

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}

export function alignOptionFieldErrors(
  errors: Record<string, string>,
  rawOptions: string[],
): Record<string, string> {
  const filledIndexes = rawOptions.flatMap((value, index) =>
    value.trim().length > 0 ? [index] : [],
  );
  const next: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    const match = /^options\.(\d+)$/.exec(key);
    if (!match) {
      next[key] = message;
      continue;
    }
    const original = filledIndexes[Number(match[1])];
    if (original !== undefined) next[`options.${original}`] = message;
  }
  return next;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    const field = key.length > 0 ? key : "form";
    if (errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}
