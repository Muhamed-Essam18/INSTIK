import { addDays, mondayOf } from "@/lib/hours/days";
import { warsawDayOf } from "@/lib/time/warsaw";

// Weeks for the creator dashboard's "views per week" chart (spec 11 FR-010). Pure: weeks start on Monday in Europe/Warsaw time.

export type Week = {
  /** The Monday, "YYYY-MM-DD". */
  start: string;
  /** The last day of the week (Sunday), "YYYY-MM-DD". */
  end: string;
  /** "Oct 13": the day the week starts. */
  label: string;
  /** The week that today belongs to: still in progress. */
  current: boolean;
};

const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayToDate = (day: string) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)));

/** The last five Monday-based weeks in Warsaw time, oldest first; the last one contains today and is marked in progress. */
export function lastFiveWeeks(now: Date): Week[] {
  const thisMonday = mondayOf(warsawDayOf(now));
  return [-28, -21, -14, -7, 0].map((offset) => {
    const start = addDays(thisMonday, offset);
    return { start, end: addDays(start, 6), label: label.format(dayToDate(start)), current: offset === 0 };
  });
}

/** Counted views per week: each day's count goes into the week that contains it; days outside the weeks are ignored. */
export function bucketByWeek(days: readonly { day: string; count: number }[], weeks: readonly Week[]): number[] {
  return weeks.map((week) => days.filter((d) => d.day >= week.start && d.day <= week.end).reduce((sum, d) => sum + d.count, 0));
}
