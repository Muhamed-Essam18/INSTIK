import { z } from "zod";
import { daysBetween } from "@/lib/hours/days";
import { APP_ZONE, startOfMonth, warsawDayOf } from "@/lib/time/warsaw";

// The owner's review rules (spec 10). Pure: no database, no session, no clock except what is passed in.

export const checklistItems = [
  { key: "stageFits", label: "The stage fits: speech and visuals match the stage." },
  { key: "audio", label: "Clear audio, no background music with lyrics." },
  { key: "realPeople", label: "A real person, real place, natural light. No AI faces." },
  { key: "safe", label: "Nothing unsafe, offensive or off-brand." },
  { key: "transcript", label: "Transcript written and checked." },
] as const;

export type CheckKey = (typeof checklistItems)[number]["key"];
export const checkKeys = checklistItems.map((i) => i.key) as [CheckKey, ...CheckKey[]];
export type Checks = Record<CheckKey, boolean>;

const checksSchema = z.object({
  stageFits: z.boolean().catch(false),
  audio: z.boolean().catch(false),
  realPeople: z.boolean().catch(false),
  safe: z.boolean().catch(false),
  transcript: z.boolean().catch(false),
});

const none = (): Checks => ({ stageFits: false, audio: false, realPeople: false, safe: false, transcript: false });

/** The stored checklist as five booleans. Missing keys, wrong types and garbage all read as unticked. */
export function parseChecks(json: unknown): Checks {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return none();
  const parsed = checksSchema.safeParse(json);
  return parsed.success ? parsed.data : none();
}

export const allTicked = (checks: Checks): boolean => checkKeys.every((k) => checks[k]);

export type ApproveProblem = "not-in-review" | "checklist" | "no-transcript" | "not-ready" | "no-stage";

/** What stops an approval, by name. An empty list means the video may be approved. */
export function approveProblems(input: {
  status: string;
  checks: Checks;
  segmentCount: number;
  stage: string | null;
  title: string;
  topic: string | null;
  durationSeconds: number | null;
  playbackId: string | null;
}): ApproveProblem[] {
  if (input.status !== "IN_REVIEW") return ["not-in-review"];
  const problems: ApproveProblem[] = [];
  if (!allTicked(input.checks)) problems.push("checklist");
  if (input.segmentCount < 1) problems.push("no-transcript");
  if (!input.stage) problems.push("no-stage");
  const ready = input.title.trim() !== "" && !!input.topic && (input.durationSeconds ?? 0) > 0 && !!input.playbackId;
  if (!ready) problems.push("not-ready");
  return problems;
}

export type QueueBadge = "Needs review" | "Transcript in progress";
export const queueBadge = (segmentCount: number): QueueBadge => (segmentCount > 0 ? "Transcript in progress" : "Needs review");

// The Warsaw zone helpers moved to `src/lib/time/warsaw.ts` (spec 11 shares them); they are re-exported here so review code is unchanged.
export const REVIEW_ZONE = APP_ZONE;
export { startOfMonth };

/** Whole calendar days (in Warsaw) from `from` to `now`, as "Today", "1 day" or "4 days". */
export function daysWaiting(from: Date, now: Date): string {
  const days = Math.max(0, daysBetween(warsawDayOf(from), warsawDayOf(now)));
  if (days === 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}
