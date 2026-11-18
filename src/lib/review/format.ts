import { stages, type StageSlug } from "@/lib/content/taxonomy";
import { REVIEW_ZONE } from "./rules";

// Small display helpers for the owner screens. Pure.

/** "6 min" for a length in seconds; "—" when it is not known yet. */
export const lengthLabel = (seconds: number | null): string => (seconds && seconds > 0 ? `${Math.max(1, Math.round(seconds / 60))} min` : "—");

/** "9 Nov", in the review time zone. */
export const shortDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: REVIEW_ZONE }).format(date);

/** "9 Nov 2026, 14:05", in the review time zone. */
export const dateTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: REVIEW_ZONE }).format(date);

/** The stage as learners read it ("Hear it"), or "—" when there is none. */
export const stageName = (slug: string | null): string => stages.find((s) => s.slug === (slug as StageSlug))?.label ?? "—";
