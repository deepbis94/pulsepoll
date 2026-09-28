"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ResultsChart } from "@/components/results-chart";
import { VotePanel } from "@/components/vote-panel";
import { formatPollTiming } from "@/lib/expiry";
import {
  POLL_INTERVAL_MS,
  PollClientError,
  fetchPoll,
  submitVote,
} from "@/lib/poll-client";
import type { PollResults } from "@/lib/poll-types";
import { applyOptimisticVote } from "@/lib/results-math";

export function PollRoom({ code }: { code: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [results, setResults] = useState<PollResults | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingOptionIds, setPendingOptionIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const voteLock = useRef(false);
  const voteErrorCode = useRef<string | null>(null);
  const resultsRef = useRef<PollResults | null>(null);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const pull = useCallback(
    async (initial: boolean) => {
      if (voteLock.current) return;
      if (!initial && document.visibilityState === "hidden") return;
      try {
        const next = await fetchPoll(code);
        if (voteLock.current) return;
        setResults(next);
        setPhase("ready");
        setRefreshWarning(null);
        if (voteErrorCode.current !== "RATE_LIMITED") {
          voteErrorCode.current = null;
          setVoteError(null);
        }
      } catch (error) {
        if (voteLock.current) return;
        if (error instanceof PollClientError && error.status === 404) {
          setPhase("missing");
          return;
        }
        const message = error instanceof Error ? error.message : "Could not load this poll";
        if (initial || resultsRef.current === null) {
          setLoadError(message);
          setPhase("error");
          return;
        }
        setRefreshWarning("Live updates paused. Still showing the last results.");
      }
    },
    [code],
  );

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const safePull = async (initial: boolean) => {
      if (stopped) return;
      await pull(initial);
    };

    const arm = () => {
      window.clearTimeout(timer);
      if (stopped || document.visibilityState === "hidden") return;
      timer = window.setTimeout(() => {
        void safePull(false).finally(arm);
      }, POLL_INTERVAL_MS);
    };

    void safePull(true).finally(arm);

    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "hidden" || stopped) return;
      void safePull(false).finally(arm);
    };

    document.addEventListener("visibilitychange", onVisibility);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pull]);

  async function onVote(optionIds: string[]) {
    if (!results || voteLock.current || results.poll.closed || results.voter.hasVoted) return;
    const previous = results;
    voteLock.current = true;
    setSubmitting(true);
    setPendingOptionIds(optionIds);
    voteErrorCode.current = null;
    setVoteError(null);
    setResults(applyOptimisticVote(results, optionIds));

    try {
      const next = await submitVote(code, optionIds);
      setResults(next);
    } catch (error) {
      if (error instanceof PollClientError && error.status === 409) {
        voteErrorCode.current = error.code;
        setResults({
          ...previous,
          poll: { ...previous.poll, closed: error.code === "POLL_CLOSED" || previous.poll.closed },
          voter: error.voter ?? {
            hasVoted: error.code === "ALREADY_VOTED",
            optionIds: error.code === "ALREADY_VOTED" ? optionIds : [],
          },
        });
        setVoteError(
          error.code === "POLL_CLOSED" ? "This poll just closed." : "You already voted.",
        );
        voteLock.current = false;
        await pull(false);
        return;
      }

      setResults(previous);
      if (error instanceof PollClientError && error.status === 429) {
        voteErrorCode.current = error.code;
        setVoteError(error.message);
      } else if (error instanceof PollClientError) {
        voteErrorCode.current = error.code;
        setVoteError(error.message);
      } else {
        setVoteError("Could not reach PulsePoll. Check your connection.");
      }
    } finally {
      voteLock.current = false;
      setSubmitting(false);
      setPendingOptionIds([]);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="mt-10 space-y-4" aria-busy="true" aria-live="polite">
        <p className="text-sm font-medium text-muted">Loading poll</p>
        <div className="h-10 w-4/5 animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
      </div>
    );
  }

  if (phase === "missing") {
    return (
      <div className="mt-10">
        <h1 className="font-serif text-3xl tracking-tight">No poll with this code</h1>
        <p className="mt-3 text-muted">Check the link, or start a new poll.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center text-sm font-semibold underline decoration-line underline-offset-4"
        >
          Create a poll
        </Link>
      </div>
    );
  }

  if (phase === "error" || !results) {
    return (
      <div className="mt-10">
        <h1 className="font-serif text-3xl tracking-tight">Couldn&apos;t load this poll</h1>
        <p className="mt-3 text-muted">{loadError ?? "Something went wrong."}</p>
        <button
          type="button"
          onClick={() => {
            setPhase("loading");
            void pull(true);
          }}
          className="mt-6 min-h-12 rounded-full bg-ink px-5 text-sm font-semibold text-card"
        >
          Try again
        </button>
      </div>
    );
  }

  const timing = formatPollTiming(results.poll.expiresAt, now);
  const showVote = !results.poll.closed && (!results.voter.hasVoted || submitting);

  return (
    <div className="mt-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{results.poll.closed ? "Closed" : "Open"}</p>
        {!results.poll.closed && timing ? <p className="text-sm text-muted">{timing}</p> : null}
      </div>
      <h1 className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
        {results.poll.question}
      </h1>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="min-h-10 rounded-full border border-line bg-card px-4 text-sm font-semibold"
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
        <p className="truncate text-sm text-muted">/p/{code}</p>
      </div>

      {refreshWarning ? (
        <p role="status" className="mt-4 text-sm text-muted">
          {refreshWarning}
        </p>
      ) : null}

      {results.poll.closed ? (
        <p className="mt-4 rounded-2xl bg-line/70 px-4 py-3 text-sm">
          Voting is closed. These are the final results.
        </p>
      ) : null}

      {results.voter.hasVoted && !results.poll.closed && !submitting ? (
        <p className="mt-4 rounded-2xl bg-line/70 px-4 py-3 text-sm">You already voted.</p>
      ) : null}

      {showVote ? (
        <VotePanel
          choiceType={results.poll.choiceType}
          options={[...results.poll.options].sort((a, b) => a.position - b.position)}
          submitting={submitting}
          pendingOptionIds={pendingOptionIds}
          error={voteError}
          onVote={(optionIds) => void onVote(optionIds)}
        />
      ) : null}

      <ResultsChart results={results} submitting={submitting} />
    </div>
  );
}
