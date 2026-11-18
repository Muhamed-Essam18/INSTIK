import { dateTime, shortDate } from "@/lib/review/format";
import type { CreatorStats as Stats } from "@/lib/creators/service";

const card = "flex flex-col gap-space-1 rounded-lg border border-hairline bg-paper p-space-4";

/** One creator's content counts and dates. Counts only: counted views and earnings arrive with the earnings screens. */
export function CreatorStats({ stats }: { stats: Stats }) {
  const items: [string, number][] = [
    ["Live", stats.counts.live],
    ["In review", stats.counts.inReview],
    ["Changes requested", stats.counts.changes],
    ["Rejected", stats.counts.rejected],
    ["Drafts and uploading", stats.counts.drafts],
    ["Approved this month", stats.approvedThisMonth],
  ];
  return (
    <div className="flex flex-col gap-space-6">
      <ul aria-label="Videos by status" className="m-0 grid list-none grid-cols-2 gap-space-4 p-0 md:grid-cols-3">
        {items.map(([label, value]) => (
          <li key={label} className={card}>
            <span className="text-label text-slate">{label}</span>
            <span className="font-display text-title text-ink">{value}</span>
          </li>
        ))}
      </ul>
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-space-6 gap-y-space-2 text-body">
        <dt className="text-slate">Joined</dt>
        <dd className="m-0 text-ink">{shortDate(stats.joinedAt)}</dd>
        <dt className="text-slate">Last upload</dt>
        <dd className="m-0 text-ink">{stats.lastUploadAt ? dateTime(stats.lastUploadAt) : "No uploads yet"}</dd>
      </dl>
    </div>
  );
}
