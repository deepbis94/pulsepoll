import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PollRoom } from "@/components/poll-room";
import { Shell } from "@/components/shell";
import { isShortCode } from "@/lib/short-code";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `Poll ${code} · PulsePoll` };
}

export default async function PollPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isShortCode(code)) notFound();

  return (
    <Shell>
      <PollRoom code={code} />
    </Shell>
  );
}
