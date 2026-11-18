import { z } from "zod";

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

export const REVIEW_ZONE = "Europe/Warsaw";

const zoneParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REVIEW_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
};

/** The first instant of the current month in the Europe/Warsaw time zone. */
export function startOfMonth(now: Date): Date {
  const { year, month } = zoneParts(now);
  // Warsaw is UTC+1 in winter and UTC+2 in summer: the right guess is the one that shows 1st, 00:00 there.
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(Date.UTC(year, month - 1, 1) - offsetHours * 3_600_000);
    const p = zoneParts(candidate);
    if (p.year === year && p.month === month && p.day === 1 && p.hour === 0 && p.minute === 0) return candidate;
  }
  return new Date(Date.UTC(year, month - 1, 1) - 3_600_000);
}

const warsawDay = (date: Date) => {
  const p = zoneParts(date);
  return Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
};

/** Whole calendar days (in Warsaw) from `from` to `now`, as "Today", "1 day" or "4 days". */
export function daysWaiting(from: Date, now: Date): string {
  const days = Math.max(0, Math.round(warsawDay(now) - warsawDay(from)));
  if (days === 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}
