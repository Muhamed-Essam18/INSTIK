// The rhythm view: days watched over the last 8 weeks. Pure. There is no streak anywhere: nothing here counts
// consecutive days, days missed or days lost. A day is either watched or a rest day, and days to come are not yet.
import { addDays, mondayOf } from "./days";

/** Counted seconds a day needs before it shows as watched (added time always counts). */
export const WATCHED_DAY_SECONDS = 60;
export const RHYTHM_WEEKS = 8;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type DayState = "watched" | "rest" | "future";
export type RhythmDay = { day: string; state: DayState; today: boolean };
export type Rhythm = { weeks: RhythmDay[][]; watchedDays: number };

type Source = { watchedByDay: Readonly<Record<string, number>>; addedDays: Iterable<string> };

function stateOf(day: string, today: string, secondsOn: number, added: Set<string>): DayState {
  if (day > today) return "future";
  return secondsOn >= WATCHED_DAY_SECONDS || added.has(day) ? "watched" : "rest";
}

/** Eight week columns of seven days, Monday first, ending with the week that contains `today`. */
export function buildRhythm({ today, watchedByDay, addedDays }: Source & { today: string }): Rhythm {
  const added = new Set(addedDays);
  const first = addDays(mondayOf(today), -7 * (RHYTHM_WEEKS - 1));
  let watchedDays = 0;
  const weeks: RhythmDay[][] = [];
  for (let w = 0; w < RHYTHM_WEEKS; w++) {
    const days: RhythmDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(first, w * 7 + d);
      const state = stateOf(day, today, watchedByDay[day] ?? 0, added);
      if (state === "watched") watchedDays += 1;
      days.push({ day, state, today: day === today });
    }
    weeks.push(days);
  }
  return { weeks, watchedDays };
}

export type StripDay = { day: string; label: (typeof WEEKDAYS)[number]; state: DayState; today: boolean };

/** This week, Monday to Sunday, for the Done screen. */
export function weekStrip({ today, watchedByDay, addedDays }: Source & { today: string }): StripDay[] {
  const added = new Set(addedDays);
  const monday = mondayOf(today);
  return WEEKDAYS.map((label, i) => {
    const day = addDays(monday, i);
    return { day, label, state: stateOf(day, today, watchedByDay[day] ?? 0, added), today: day === today };
  });
}

/** The first day shown in the rhythm, for querying. */
export const rhythmStart = (today: string): string => addDays(mondayOf(today), -7 * (RHYTHM_WEEKS - 1));
