import { z } from "zod";

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
          .max(120, "Options must be 120 characters or fewer"),
      )
      .min(2, "Add at least 2 options")
      .max(10, "A poll can have at most 10 options"),
  );

export const createPollSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(280, "Question must be 280 characters or fewer"),
  options: optionList,
  choiceType: z.enum(["SINGLE", "MULTIPLE"]).default("SINGLE"),
  durationMinutes: z
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(60 * 24 * 30, "Duration cannot exceed 30 days")
    .optional(),
});

export const castVoteSchema = z.object({
  optionIds: z
    .array(z.string().trim().min(1))
    .min(1, "Choose an option")
    .max(10, "Too many options"),
});

export type CreatePollInput = z.output<typeof createPollSchema>;
export type CastVoteInput = z.output<typeof castVoteSchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}
