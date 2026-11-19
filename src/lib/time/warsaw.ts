// Months, days and weeks for the creator programme follow one zone: Europe/Warsaw (specs 10 and 11).
// Pure: built-in Intl only, no database, no clock except what is passed in.

export const APP_ZONE = "Europe/Warsaw";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: APP_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

const zoneParts = (date: Date) => {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The first instant of a calendar month in Warsaw. Warsaw is UTC+1 in winter and UTC+2 in summer: the right guess shows 1st, 00:00 there. */
function firstInstant(year: number, month: number): Date {
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(Date.UTC(year, month - 1, 1) - offsetHours * 3_600_000);
    const p = zoneParts(candidate);
    if (p.year === year && p.month === month && p.day === 1 && p.hour === 0 && p.minute === 0) return candidate;
  }
  return new Date(Date.UTC(year, month - 1, 1) - 3_600_000);
}

/** The first instant of the current month in the Europe/Warsaw time zone. */
export function startOfMonth(now: Date): Date {
  const { year, month } = zoneParts(now);
  return firstInstant(year, month);
}

const KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** True for a month key such as "2026-11". */
export const isMonthKey = (text: unknown): text is string => typeof text === "string" && KEY.test(text);

/** The Warsaw month of an instant, as "YYYY-MM". */
export function monthKeyOf(instant: Date): string {
  const { year, month } = zoneParts(instant);
  return `${year}-${pad(month)}`;
}

/** The Warsaw calendar day of an instant, as "YYYY-MM-DD". */
export function warsawDayOf(instant: Date): string {
  const parts = dayFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const split = (key: string): [number, number] => {
  const match = KEY.exec(key);
  if (!match) throw new Error("Not a month key");
  return [Number(match[1]), Number(match[2])];
};

export const nextMonth = (key: string): string => {
  const [year, month] = split(key);
  return month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
};

export const previousMonth = (key: string): string => {
  const [year, month] = split(key);
  return month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
};

/** The month as instants: `start` is its first instant, `end` the first instant of the next month (exclusive). */
export function monthRange(key: string): { start: Date; end: Date } {
  const [year, month] = split(key);
  const [nextYear, nextMonthNumber] = split(nextMonth(key));
  return { start: firstInstant(year, month), end: firstInstant(nextYear, nextMonthNumber) };
}

/** True once the month has fully passed in Warsaw time (from the first instant of the next month). */
export const hasMonthEnded = (key: string, now: Date): boolean => now.getTime() >= monthRange(key).end.getTime();
