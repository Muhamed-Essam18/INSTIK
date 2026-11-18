import { dateTime } from "@/lib/review/format";
import type { HistoryEntry } from "@/lib/review/service";

const label: Record<string, string> = {
  IN_REVIEW: "Submitted for review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PROCESSING: "Processing",
  UPLOADING: "Uploading",
  DRAFT: "Back to draft",
};

/** The video's history, newest first: what happened, who did it, when, the note, and a mark when a decision's email did not go out. */
export function ReviewHistory({ items }: { items: readonly HistoryEntry[] }) {
  if (items.length === 0) return <p className="m-0 text-body text-slate">No history yet.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-space-3 p-0">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-hairline bg-paper p-space-4">
          <p className="m-0 text-label text-ink">
            {label[item.toStatus] ?? item.toStatus} <span className="font-normal text-slate">· {item.actorLabel} · {dateTime(item.createdAt)}</span>
            {item.emailFailed && <span className="ml-space-2 rounded-pill bg-coral-tint px-space-2 py-0.5 text-caption">Email not sent</span>}
          </p>
          {item.note && <p className="m-0 text-body text-ink">{item.note}</p>}
        </li>
      ))}
    </ol>
  );
}
