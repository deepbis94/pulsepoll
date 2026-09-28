import { describe, expect, it } from "vitest";

import {
  alignOptionFieldErrors,
  castVoteSchema,
  parseCreatePollForm,
  zodFieldErrors,
} from "@/lib/validators";

describe("parseCreatePollForm", () => {
  it("trims the question, drops blank options, and omits an empty duration", () => {
    const parsed = parseCreatePollForm({
      question: "  Lunch?  ",
      options: [" Soup ", " ", "Salad"],
      choiceType: "SINGLE",
      durationMinutes: "  ",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      question: "Lunch?",
      options: ["Soup", "Salad"],
      choiceType: "SINGLE",
    });
  });

  it("rejects fewer than two real options", () => {
    const parsed = parseCreatePollForm({
      question: "Lunch?",
      options: ["Soup", "   "],
      choiceType: "SINGLE",
      durationMinutes: "",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodFieldErrors(parsed.error).options).toBe("Add at least 2 options");
  });

  it("rejects more than ten options", () => {
    const parsed = parseCreatePollForm({
      question: "Lunch?",
      options: Array.from({ length: 11 }, (_, index) => `Option ${index}`),
      choiceType: "MULTIPLE",
      durationMinutes: "",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodFieldErrors(parsed.error).options).toBe("A poll can have at most 10 options");
  });

  it("maps an over-long option back onto the original row, skipping blanks", () => {
    const raw = ["  ", "x".repeat(121), "Salad"];
    const parsed = parseCreatePollForm({
      question: "Lunch?",
      options: raw,
      choiceType: "SINGLE",
      durationMinutes: "",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const errors = alignOptionFieldErrors(zodFieldErrors(parsed.error), raw);
    expect(errors["options.1"]).toBe("Options must be 120 characters or fewer");
  });

  it("requires a whole number of minutes inside 30 days", () => {
    const fractional = parseCreatePollForm({
      question: "Lunch?",
      options: ["Soup", "Salad"],
      choiceType: "SINGLE",
      durationMinutes: "1.5",
    });
    expect(fractional.success).toBe(false);
    if (!fractional.success) {
      expect(zodFieldErrors(fractional.error).durationMinutes).toBe(
        "Duration must be a whole number of minutes",
      );
    }

    const tooLong = parseCreatePollForm({
      question: "Lunch?",
      options: ["Soup", "Salad"],
      choiceType: "SINGLE",
      durationMinutes: String(60 * 24 * 30 + 1),
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(zodFieldErrors(tooLong.error).durationMinutes).toBe(
        "Duration cannot exceed 30 days",
      );
    }
  });

  it("accepts a duration in minutes", () => {
    const parsed = parseCreatePollForm({
      question: "Lunch?",
      options: ["Soup", "Salad"],
      choiceType: "MULTIPLE",
      durationMinutes: "15",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.durationMinutes).toBe(15);
    expect(parsed.data.choiceType).toBe("MULTIPLE");
  });
});

describe("castVoteSchema", () => {
  it("requires at least one option id", () => {
    const parsed = castVoteSchema.safeParse({ optionIds: [] });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodFieldErrors(parsed.error).optionIds).toBe("Choose an option");
  });

  it("trims option ids", () => {
    const parsed = castVoteSchema.safeParse({ optionIds: ["  opt_1  "] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.optionIds).toEqual(["opt_1"]);
  });
});
