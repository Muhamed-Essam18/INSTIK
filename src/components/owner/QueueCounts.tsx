import Link from "next/link";
import { ownerWaitingPath } from "@/lib/routes";
import type { Queue } from "@/lib/review/service";

const card = "flex flex-col gap-space-1 rounded-lg border border-hairline bg-paper p-space-4";
const number = "font-display text-title text-ink";

/** The four counts above the queue (docs/design/OwnerReviewQueue.dc.html). Waiting on creator opens the list behind it. */
export function QueueCounts({ counts }: { counts: Queue["counts"] }) {
  return (
    <ul aria-label="Queue counts" className="m-0 grid list-none grid-cols-2 gap-space-4 p-0 md:grid-cols-4">
      <li className={card}>
        <span className="text-label text-slate">Needs review</span>
        <span className={number}>{counts.needsReview}</span>
      </li>
      <li className={card}>
        <span className="text-label text-slate">Transcript in progress</span>
        <span className={number}>{counts.transcriptInProgress}</span>
      </li>
      <li className="flex">
        <Link
          href={ownerWaitingPath()}
          aria-label={`Waiting on creator: ${counts.waitingOnCreator}. See the videos.`}
          className={`${card} min-h-11 w-full no-underline hover:bg-cream`}
        >
          <span className="text-label text-slate">Waiting on creator</span>
          <span className={number}>{counts.waitingOnCreator}</span>
          <span className="text-caption text-slate">Changes requested</span>
        </Link>
      </li>
      <li className={card}>
        <span className="text-label text-slate">Approved this month</span>
        <span className={number}>{counts.approvedThisMonth}</span>
      </li>
    </ul>
  );
}
