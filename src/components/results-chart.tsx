"use client";

import { useEffect, useState } from "react";

import type { PollResults } from "@/lib/poll-types";
import {
  barWidthPercent,
  formatLastUpdated,
  formatPercent,
  formatVoterCount,
} from "@/lib/results-math";

export function ResultsChart({
  results,
  submitting,
}: {
  results: PollResults;
  submitting: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const voted = new Set(results.voter.optionIds);
  const options = [...results.poll.options].sort((a, b) => a.position - b.position);

  return (
    <section className="mt-8" aria-labelledby="results-heading">
      <div className="flex items-end justify-between gap-3">
        <h2 id="results-heading" className="font-serif text-2xl tracking-tight">
          {results.poll.closed ? "Final results" : "Live results"}
        </h2>
        <p className="text-sm font-semibold tabular-nums" aria-live="polite">
          {formatVoterCount(results.totalVotes)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {submitting ? "Sending your vote…" : formatLastUpdated(results.updatedAt, now)}
      </p>

      {results.totalVotes === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
          {results.poll.closed
            ? "No votes came in before this poll closed."
            : "No voters yet. The bars will move as soon as someone votes."}
        </p>
      ) : null}

      <ol className="mt-4 space-y-4">
        {options.map((option) => {
          const width = barWidthPercent(option.votes, results.totalVotes);
          const yours = voted.has(option.id);
          return (
            <li key={option.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {option.label}
                  {yours ? <span className="ml-2 text-xs font-semibold text-pulse">Your vote</span> : null}
                </p>
                <p className="shrink-0 text-sm tabular-nums text-muted">
                  {formatPercent(option.votes, results.totalVotes)}
                  <span className="ml-2">{option.votes}</span>
                </p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div
                  className="h-full rounded-full bg-pulse transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
