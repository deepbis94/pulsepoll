import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-8">
      <header>
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pulse" />
          </span>
          <span className="text-sm font-semibold tracking-tight">PulsePoll</span>
        </Link>
      </header>
      {children}
    </div>
  );
}
