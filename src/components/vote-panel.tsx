"use client";

import { useState } from "react";

import type { ChoiceType } from "@/lib/poll-types";

type VoteOption = {
  id: string;
  label: string;
};

export function VotePanel({
  choiceType,
  options,
  submitting,
  pendingOptionIds,
  error,
  onVote,
}: {
  choiceType: ChoiceType;
  options: VoteOption[];
  submitting: boolean;
  pendingOptionIds: string[];
  error: string | null;
  onVote: (optionIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const pending = new Set(pendingOptionIds);

  function toggle(optionId: string) {
    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  return (
    <section className="mt-6" aria-labelledby="vote-heading">
      <h2 id="vote-heading" className="font-serif text-2xl tracking-tight">
        {choiceType === "SINGLE" ? "Cast your vote" : "Choose any that fit"}
      </h2>
      {error ? (
        <p role="alert" className="mt-3 rounded-2xl bg-pulse/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {options.map((option) => {
          const isSelected = choiceType === "MULTIPLE" && selected.includes(option.id);
          const isPending = pending.has(option.id);
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={submitting}
                aria-pressed={choiceType === "MULTIPLE" ? isSelected : undefined}
                aria-busy={isPending}
                onClick={() => {
                  if (choiceType === "SINGLE") onVote([option.id]);
                  else toggle(option.id);
                }}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-medium disabled:opacity-60 ${
                  isSelected || isPending
                    ? "border-pulse bg-pulse/10 text-ink"
                    : "border-line bg-card text-ink"
                }`}
              >
                <span>{option.label}</span>
                <span className="text-sm text-muted">
                  {isPending ? "Sending…" : isSelected ? "Selected" : choiceType === "SINGLE" ? "Vote" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {choiceType === "MULTIPLE" ? (
        <button
          type="button"
          disabled={submitting || selected.length === 0}
          aria-busy={submitting}
          onClick={() => onVote(selected)}
          className="mt-4 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-card disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Submit vote"}
        </button>
      ) : null}
    </section>
  );
}
