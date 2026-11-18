import Link from "next/link";
import { lengthLabel, shortDate, stageName } from "@/lib/review/format";
import type { QueueRow } from "@/lib/review/service";
import { ownerReviewVideoPath } from "@/lib/routes";

const th = "px-space-4 py-space-3 font-semibold";
const td = "px-space-4 py-space-3";

const badgeTone: Record<string, string> = {
  "Needs review": "bg-sun text-ink",
  "Transcript in progress": "bg-teal text-ink",
  "Changes requested": "bg-coral-tint text-ink",
};

/**
 * The review queue table, oldest first (docs/design/OwnerReviewQueue.dc.html). The list simply ends: no infinite scroll, no "load more".
 * `list` decides the button: Review (nothing written yet), Continue (a transcript has been started) or View (waiting on the creator).
 */
export function QueueTable({ rows, list }: { rows: readonly QueueRow[]; list: "review" | "waiting" }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-paper p-space-6">
        <p className="m-0 text-body-lg text-ink">{list === "waiting" ? "Nothing waiting on creators." : "Nothing waiting."}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-paper">
      <table className="w-full min-w-[820px] border-collapse text-left text-body">
        <caption className="sr-only">{list === "waiting" ? "Videos waiting on their creators, oldest first" : "Videos waiting for review, oldest first"}</caption>
        <thead>
          <tr className="border-b border-hairline text-label text-slate">
            <th scope="col" className={th}>Video</th>
            <th scope="col" className={th}>Creator</th>
            <th scope="col" className={th}>Stage</th>
            <th scope="col" className={th}>Length</th>
            <th scope="col" className={th}>{list === "waiting" ? "Changes asked" : "Submitted"}</th>
            <th scope="col" className={th}>Waiting</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const action = list === "waiting" ? "View" : row.hasTranscript ? "Continue" : "Review";
            return (
              <tr key={row.id} className="border-b border-hairline align-top last:border-b-0">
                <th scope="row" className={`${td} font-semibold`}>
                  <Link href={ownerReviewVideoPath(row.id)} className="inline-flex min-h-11 items-center">
                    {row.title || "Untitled"}
                  </Link>
                </th>
                <td className={td}>{row.creatorName}</td>
                <td className={td}>{stageName(row.stage)}</td>
                <td className={td}>{lengthLabel(row.durationSeconds)}</td>
                <td className={td}>{shortDate(row.submittedAt)}</td>
                <td className={td}>{row.waiting}</td>
                <td className={td}>
                  <span className={`inline-flex items-center rounded-pill px-space-3 py-1 text-label font-semibold whitespace-nowrap ${badgeTone[row.badge] ?? "bg-cream text-ink"}`}>
                    {row.badge}
                  </span>
                </td>
                <td className={td}>
                  <Link
                    href={ownerReviewVideoPath(row.id)}
                    aria-label={`${action} ${row.title || "Untitled"}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate px-space-4 text-label no-underline"
                  >
                    {action}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
