// Local days in the learner's IANA time zone. Pure: built-in Intl only, no date library.
// A day is a "YYYY-MM-DD" string. Instants are epoch milliseconds.

const formatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

/** True for a time zone name the runtime knows (for example "Africa/Cairo"). */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    dayFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The calendar day of `instantMs` in `timeZone`. */
export function localDay(instantMs: number, timeZone: string): string {
  const parts = dayFormatter(timeZone).formatToParts(new Date(instantMs));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar day in `timeZone` at `nowMs`. */
export const todayIn = (timeZone: string, nowMs: number): string => localDay(nowMs, timeZone);

export type DayPart = { day: string; seconds: number };

/**
 * Places an interval of `seconds` that starts at `startMs` on local days, splitting at local midnight so no second
 * lands on the wrong day. Handles half-hour and 45-minute zones and 23- and 25-hour DST days.
 */
export function splitByLocalDay(startMs: number, seconds: number, timeZone: string): DayPart[] {
  if (!(seconds > 0)) return [];
  const parts: DayPart[] = [];
  let cursor = startMs;
  let remaining = seconds * 1000;
  while (remaining > 0) {
    const day = localDay(cursor, timeZone);
    const end = cursor + remaining;
    if (localDay(end - 1, timeZone) === day) {
      parts.push({ day, seconds: remaining / 1000 });
      break;
    }
    // The first millisecond that belongs to the next local day (never more than 26 hours ahead).
    let lo = cursor;
    let hi = Math.min(end, cursor + 26 * 3_600_000);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (localDay(mid, timeZone) === day) lo = mid;
      else hi = mid;
    }
    parts.push({ day, seconds: (hi - cursor) / 1000 });
    remaining -= hi - cursor;
    cursor = hi;
  }
  return parts;
}

const DAY_MS = 86_400_000;
const toUtc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day: string, n: number): string => fromUtc(toUtc(day) + n * DAY_MS);

/** 0 for Monday through 6 for Sunday. */
export const weekdayIndex = (day: string): number => (new Date(toUtc(day)).getUTCDay() + 6) % 7;

/** The Monday of the week that contains `day`. */
export const mondayOf = (day: string): string => addDays(day, -weekdayIndex(day));

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** True for a well-formed "YYYY-MM-DD" that is a real calendar date. */
export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUtc(toUtc(value)) === value;
}
