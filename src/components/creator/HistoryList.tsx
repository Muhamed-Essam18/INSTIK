import type { HistoryItem } from "@/lib/creator/list";

/** Every status change, newest first: what happened, when, who (You or Instik) and any note (docs/design/CreatorVideo.dc.html). */
export function HistoryList({ items }: { items: readonly HistoryItem[] }) {
  if (items.length === 0) return <p className="m-0 text-body text-slate">Nothing has happened to this video yet.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-space-4 p-0">
      {items.map((item) => (
        <li key={`${item.iso}-${item.label}`} className="flex flex-col gap-1 border-l-2 border-hairline pl-space-4">
          <span className="text-body font-semibold text-ink">{item.label}</span>
          <span className="text-label text-slate">
            <time dateTime={item.iso}>{item.when}</time> · {item.by}
          </span>
          {item.note && <q className="text-body text-ink">{item.note}</q>}
        </li>
      ))}
    </ol>
  );
}
