// The rows of My videos, worked out from the creator's videos (spec FR-030 to FR-034). Pure.

import type { CreatorVideo, StatusHistoryEntry } from "@/lib/content/creator-reads";
import type { VideoStatusName } from "@/lib/content/status";
import { stageLabel, stages, type StageSlug } from "@/lib/content/taxonomy";
import { creatorVideoPath } from "@/lib/routes";
import { displayStatus, listFor, shortNote, type Display, type Filter } from "./rules";

export type VideoRow = {
  id: string;
  href: string;
  title: string;
  stage: string | null;
  display: Display;
  /** The latest note, shortened, or null for a dash. */
  note: string | null;
  isLive: boolean;
  updated: string;
};

const stageText = (slug: string | null): string | null =>
  slug && stages.some((s) => s.slug === slug) ? stageLabel(slug as StageSlug) : null;

/** "Today", or the day and month ("12 Nov"), in UTC so the server and the browser agree. */
export function shortDate(date: Date, now: Date): string {
  const sameDay = date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  if (sameDay) return "Today";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** The rows for one filter, most recently updated first. Deleted videos never appear. */
export function rowsFor(videos: readonly CreatorVideo[], filter: Filter, now: Date): VideoRow[] {
  return listFor(videos, filter, now)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((video) => {
      const display = displayStatus(video, now);
      return {
        id: video.id,
        href: creatorVideoPath(video.id),
        title: video.title.trim() || "Untitled video",
        stage: stageText(video.proposedStage ?? video.stage),
        display,
        note: shortNote(video.latestNote),
        isLive: display.key === "live",
        updated: shortDate(video.updatedAt, now),
      };
    });
}

// ---- The history on a video's status page ---------------------------------------------------------------------------------

export type HistoryItem = {
  label: string;
  /** "12 Nov, 14:20" in UTC. */
  when: string;
  /** "You" or "Instik". */
  by: string;
  note: string | null;
  iso: string;
};

/** The creator-side words for a move (docs/design/CreatorVideo.dc.html): moving into review is their own "Submitted". */
export function historyLabel(from: VideoStatusName | null, to: VideoStatusName): string {
  switch (to) {
    case "UPLOADING":
      return "Uploaded";
    case "PROCESSING":
      return "Processing";
    case "IN_REVIEW":
      return from === "CHANGES_REQUESTED" || from === "PROCESSING" ? "Submitted" : "In review";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "APPROVED":
      return "Approved and live";
    case "REJECTED":
      return "Rejected";
    case "DRAFT":
      return from === null ? "Draft started" : "Back to draft";
  }
}

export function dateTime(date: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date);
  return `${day}, ${time}`;
}

/** Every status change, newest first, with when, who (You or Instik) and the note. */
export function historyItems(entries: readonly StatusHistoryEntry[]): HistoryItem[] {
  return [...entries]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((e) => ({
      label: historyLabel(e.fromStatus, e.toStatus),
      when: dateTime(e.createdAt),
      by: e.byYou ? "You" : "Instik",
      note: e.note?.trim() || null,
      iso: e.createdAt.toISOString(),
    }));
}
