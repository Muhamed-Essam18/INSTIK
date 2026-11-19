import type { AnswerCounts } from "@/lib/earnings/dashboard-data";

/**
 * How learners answered فاهم؟ for one video: teal for "mostly", sun for "some of it", coral for "not yet". The bar is an image with a text
 * alternative that gives the three proportions; with no answers yet it says so in words.
 */
export function AnswerBar({ answers }: { answers: AnswerCounts }) {
  const total = answers.mostly + answers.some + answers.notYet;
  if (total === 0) return <span className="text-caption text-slate">No answers yet</span>;
  const pct = (n: number) => Math.round((n / total) * 100);
  const parts = [
    { key: "mostly", n: answers.mostly, className: "bg-teal" },
    { key: "some of it", n: answers.some, className: "bg-sun" },
    { key: "not yet", n: answers.notYet, className: "bg-coral" },
  ];
  const label = `فاهم؟ answers: ${parts.map((p) => `${p.key} ${pct(p.n)}%`).join(", ")}`;
  return (
    <div role="img" aria-label={label} className="flex h-2.5 w-[140px] overflow-hidden rounded-pill">
      {parts.map((p) => (p.n > 0 ? <span key={p.key} style={{ width: `${pct(p.n)}%` }} className={p.className} /> : null))}
    </div>
  );
}
