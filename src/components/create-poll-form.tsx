"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { PollClientError, createPollRequest } from "@/lib/poll-client";
import {
  MAX_OPTION_LENGTH,
  MAX_OPTIONS,
  MAX_QUESTION_LENGTH,
  MIN_OPTIONS,
  alignOptionFieldErrors,
  parseCreatePollForm,
  zodFieldErrors,
  type CreatePollFormValues,
} from "@/lib/validators";

type OptionRow = { key: string; value: string };

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/15 aria-invalid:border-pulse";

const DURATION_PRESETS = [
  { label: "5 min", minutes: "5" },
  { label: "15 min", minutes: "15" },
  { label: "1 hour", minutes: "60" },
  { label: "1 day", minutes: "1440" },
] as const;

const INITIAL_OPTIONS: OptionRow[] = [
  { key: "option-1", value: "" },
  { key: "option-2", value: "" },
];

export function CreatePollForm() {
  const router = useRouter();
  const formId = useId();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<OptionRow[]>(INITIAL_OPTIONS);
  const optionKey = useRef(INITIAL_OPTIONS.length);
  const [choiceType, setChoiceType] = useState<CreatePollFormValues["choiceType"]>("SINGLE");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(field: string) {
    setErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = parseCreatePollForm({
      question,
      options: options.map((option) => option.value),
      choiceType,
      durationMinutes,
    });

    if (!parsed.success) {
      const nextErrors = alignOptionFieldErrors(
        zodFieldErrors(parsed.error),
        options.map((option) => option.value),
      );
      setErrors(nextErrors);
      const form = event.currentTarget;
      window.setTimeout(() => {
        form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      }, 0);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const created = await createPollRequest(parsed.data);
      router.push(created.path);
    } catch (error) {
      const message =
        error instanceof PollClientError ? error.message : "Could not create this poll.";
      setFormError(message);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-8 rounded-3xl border border-line bg-card p-4 shadow-[0_1px_0_rgba(28,23,20,0.04)] sm:p-5"
    >
      <h2 className="font-serif text-2xl tracking-tight">New poll</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Blank options are dropped. You need at least two with text.
      </p>

      {formError ? (
        <p role="alert" className="mt-4 rounded-2xl bg-pulse/10 px-4 py-3 text-sm text-ink">
          {formError}
        </p>
      ) : null}

      <div className="mt-5">
        <label htmlFor={`${formId}-question`} className="text-sm font-semibold">
          Question
        </label>
        <textarea
          id={`${formId}-question`}
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          rows={3}
          aria-invalid={errors.question ? true : undefined}
          aria-describedby={errors.question ? `${formId}-question-error` : undefined}
          placeholder="What should we eat?"
          onChange={(event) => {
            setQuestion(event.target.value);
            clearError("question");
          }}
          className={`${fieldClass} mt-2 resize-none`}
        />
        <div className="mt-1 flex justify-between gap-3 text-xs text-muted">
          {errors.question ? (
            <p id={`${formId}-question-error`} className="text-pulse">
              {errors.question}
            </p>
          ) : (
            <span>Required</span>
          )}
          <span>
            {question.trim().length}/{MAX_QUESTION_LENGTH}
          </span>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">Options</legend>
        <div className="mt-2 space-y-2">
          {options.map((option, index) => {
            const error = errors[`options.${index}`];
            const inputId = `${formId}-option-${option.key}`;
            return (
              <div key={option.key}>
                <div className="flex items-center gap-2">
                  <label htmlFor={inputId} className="sr-only">
                    Option {index + 1}
                  </label>
                  <input
                    id={inputId}
                    value={option.value}
                    maxLength={MAX_OPTION_LENGTH}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    placeholder={`Option ${index + 1}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      setOptions((current) =>
                        current.map((row) => (row.key === option.key ? { ...row, value } : row)),
                      );
                      clearError(`options.${index}`);
                      clearError("options");
                    }}
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    aria-label={`Remove option ${index + 1}`}
                    disabled={options.length <= MIN_OPTIONS || submitting}
                    onClick={() => {
                      setOptions((current) => current.filter((row) => row.key !== option.key));
                      clearError("options");
                    }}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line text-lg text-muted enabled:hover:border-ink enabled:hover:text-ink disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
                {error ? (
                  <p id={`${inputId}-error`} className="mt-1 text-xs text-pulse">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {errors.options ? (
          <p role="alert" className="mt-2 text-sm text-pulse">
            {errors.options}
          </p>
        ) : null}
        <button
          type="button"
          disabled={options.length >= MAX_OPTIONS || submitting}
          onClick={() => {
            optionKey.current += 1;
            const key = `option-${optionKey.current}`;
            setOptions((current) => [...current, { key, value: "" }]);
          }}
          className="mt-3 min-h-12 w-full rounded-2xl border border-dashed border-line text-sm font-semibold text-ink enabled:hover:border-ink disabled:opacity-40"
        >
          Add option ({options.length}/{MAX_OPTIONS})
        </button>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold">Choices</legend>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choice type">
          {(
            [
              ["SINGLE", "Pick one"],
              ["MULTIPLE", "Pick any"],
            ] as const
          ).map(([value, label]) => {
            const selected = choiceType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoiceType(value)}
                className={`min-h-12 rounded-2xl border px-3 text-sm font-semibold ${
                  selected ? "border-ink bg-ink text-card" : "border-line bg-paper text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor={`${formId}-duration`} className="text-sm font-semibold">
          Duration
        </label>
        <p className="mt-1 text-sm text-muted">Optional. Leave blank to keep the poll open.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={durationMinutes === ""}
            onClick={() => {
              setDurationMinutes("");
              clearError("durationMinutes");
            }}
            className={`min-h-10 rounded-full border px-3 text-sm ${
              durationMinutes === "" ? "border-ink bg-ink text-card" : "border-line bg-paper"
            }`}
          >
            No limit
          </button>
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              aria-pressed={durationMinutes === preset.minutes}
              onClick={() => {
                setDurationMinutes(preset.minutes);
                clearError("durationMinutes");
              }}
              className={`min-h-10 rounded-full border px-3 text-sm ${
                durationMinutes === preset.minutes
                  ? "border-ink bg-ink text-card"
                  : "border-line bg-paper"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          id={`${formId}-duration`}
          inputMode="numeric"
          value={durationMinutes}
          aria-invalid={errors.durationMinutes ? true : undefined}
          aria-describedby={errors.durationMinutes ? `${formId}-duration-error` : undefined}
          placeholder="Minutes"
          onChange={(event) => {
            setDurationMinutes(event.target.value);
            clearError("durationMinutes");
          }}
          className={`${fieldClass} mt-2`}
        />
        {errors.durationMinutes ? (
          <p id={`${formId}-duration-error`} className="mt-1 text-sm text-pulse">
            {errors.durationMinutes}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="mt-6 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-card disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create poll"}
      </button>
    </form>
  );
}
