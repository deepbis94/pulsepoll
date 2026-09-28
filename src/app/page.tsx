import { Shell } from "@/components/shell";

export default function HomePage() {
  return (
    <Shell>
      <h1 className="mt-10 font-serif text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
        Every vote is a heartbeat.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Create a poll, share a short link, and watch the bars move as the room votes.
      </p>
      <section className="mt-10 rounded-3xl border border-line bg-card p-5 shadow-[0_1px_0_rgba(28,23,20,0.04)]">
        <h2 className="font-serif text-2xl tracking-tight">New poll</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A question, two to ten options, and an optional closing time. The form lands
          on this card next.
        </p>
      </section>
    </Shell>
  );
}
