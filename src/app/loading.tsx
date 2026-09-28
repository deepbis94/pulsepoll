import { Shell } from "@/components/shell";

export default function Loading() {
  return (
    <Shell>
      <div className="mt-10 space-y-4" aria-busy="true" aria-live="polite">
        <p className="text-sm font-medium text-muted">Loading</p>
        <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-line motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-3xl bg-line motion-reduce:animate-none" />
      </div>
    </Shell>
  );
}
