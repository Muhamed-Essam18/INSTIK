// Totals and formatting for hours. Pure.

export type DayRow = { videoSlug: string; day: string; seconds: number };
export type ManualRow = { day: string; minutes: number };

/** Watched seconds plus added minutes, in seconds. Sub-minute remainders are kept, never rounded away. */
export const totalSeconds = (watchedSeconds: number, addedMinutes: number): number =>
  Math.max(0, Math.round(watchedSeconds)) + Math.max(0, Math.round(addedMinutes)) * 60;

export function splitHoursMinutes(seconds: number): { hours: number; minutes: number } {
  const whole = Math.max(0, Math.floor(seconds));
  return { hours: Math.floor(whole / 3600), minutes: Math.floor((whole % 3600) / 60) };
}

/** "12h 40m", or "0h 0m" for nothing yet. */
export function formatHours(seconds: number): string {
  const { hours, minutes } = splitHoursMinutes(seconds);
  return `${hours}h ${minutes}m`;
}

/** "24 min" (whole minutes, rounded down). */
export const formatMinutes = (seconds: number): string => `${Math.floor(Math.max(0, seconds) / 60)} min`;

/** Whole hours as a number, for estimates: 12h 40m is 12.67. */
export const hoursOf = (seconds: number): number => Math.max(0, seconds) / 3600;

/** A spoken form for screen readers: "12 hours 40 minutes". */
export function spokenHours(seconds: number): string {
  const { hours, minutes } = splitHoursMinutes(seconds);
  const h = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const m = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return `${h} ${m}`;
}

/**
 * Counted watching on `today`. Time the learner added from outside Instik is not included: Done for today and
 * "watched today" are about watching, and added time never reaches the daily goal.
 */
export function todaySeconds(rows: DayRow[], today: string): number {
  return Math.round(rows.filter((r) => r.day === today).reduce((n, r) => n + r.seconds, 0));
}

/** Distinct videos with counted time on `today`. */
export function videosToday(rows: DayRow[], today: string): number {
  return new Set(rows.filter((r) => r.day === today && r.seconds > 0).map((r) => r.videoSlug)).size;
}
