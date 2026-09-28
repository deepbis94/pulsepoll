import Link from "next/link";

import { Shell } from "@/components/shell";

export default function NotFound() {
  return (
    <Shell>
      <h1 className="mt-10 font-serif text-3xl tracking-tight">Nothing here</h1>
      <p className="mt-3 text-muted">That link does not match a page.</p>
      <Link
        href="/"
        className="mt-6 inline-flex text-sm font-semibold underline decoration-line underline-offset-4"
      >
        Back home
      </Link>
    </Shell>
  );
}
