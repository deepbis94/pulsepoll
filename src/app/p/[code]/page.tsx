import Link from "next/link";

import { Shell } from "@/components/shell";

export default async function PollPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <Shell>
      <p className="mt-10 text-sm font-medium text-muted">Poll</p>
      <h1 className="mt-2 font-mono text-3xl tracking-tight text-ink">{code}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Voting and the live chart will fill this screen. A reload already knows whether
        you voted, via the results API.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex text-sm font-semibold text-ink underline decoration-line underline-offset-4"
      >
        Create a poll
      </Link>
    </Shell>
  );
}
