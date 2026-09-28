"use client";

import { Shell } from "@/components/shell";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Shell>
      <h1 className="mt-10 font-serif text-3xl tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted">The page could not be loaded. You can try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-card"
      >
        Try again
      </button>
    </Shell>
  );
}
