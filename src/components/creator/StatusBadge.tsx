import type { Display, DisplayKey } from "@/lib/creator/rules";

// A video's status as a small pill. Colour never carries the meaning alone: the words do.
const tone: Record<DisplayKey, string> = {
  draft: "bg-cream text-ink border border-slate",
  "upload-unfinished": "bg-cream text-ink border border-slate",
  uploading: "bg-sun text-ink",
  processing: "bg-sun text-ink",
  "ready-to-submit": "bg-teal text-ink",
  "in-review": "bg-sun text-ink",
  "changes-requested": "bg-coral-tint text-ink",
  rejected: "bg-hairline text-ink",
  live: "bg-teal text-ink",
};

export function StatusBadge({ display }: { display: Display }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className={`inline-flex items-center rounded-pill px-space-3 py-1 text-label font-semibold whitespace-nowrap ${tone[display.key]}`}>
        {display.label}
      </span>
      {display.pending && <span className="text-caption text-slate">{display.pending.label}</span>}
    </span>
  );
}
