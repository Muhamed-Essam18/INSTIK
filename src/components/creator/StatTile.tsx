import type { ReactNode } from "react";

/** One number on the creator dashboard: a label, the value, and an optional calm line under it (docs/design/CreatorDashboard.dc.html). */
export function StatTile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-space-1 rounded-lg bg-paper p-space-6 shadow-sm">
      <span className="text-label text-slate">{label}</span>
      <span className="font-display text-title text-ink">{value}</span>
      {note ? <span className="text-caption text-slate">{note}</span> : null}
    </div>
  );
}
