// Time the learner adds from outside Instik: validation and what removal may change. Pure.
import { z } from "zod";
import { addDays, daysBetween, isDay } from "./days";
import { totalSeconds } from "./totals";
import type { Stage } from "@/lib/learner/profile-rules";

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 600;
export const MAX_ENTRIES_PER_DAY = 20;
export const MAX_DAYS_BACK = 365;

export type ManualField = "minutes" | "day";
export type ManualCheck = { ok: true } | { ok: false; field: ManualField; message: string };

/** The shape of an added-time request. The server also re-checks the date against the learner's "today". */
export const manualTimeSchema = z.object({
  languageCode: z.string().min(1).max(20),
  minutes: z.number().int().min(MIN_MINUTES).max(MAX_MINUTES),
  day: z.string().refine(isDay),
  timeZone: z.string().min(1).max(64),
});

export function validateManualTime(input: { minutes: unknown; day: unknown; today: string }): ManualCheck {
  const { minutes, day, today } = input;
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return { ok: false, field: "minutes", message: `Enter a whole number of minutes, from ${MIN_MINUTES} to ${MAX_MINUTES}.` };
  }
  if (!isDay(day)) return { ok: false, field: "day", message: "Pick a date." };
  if (daysBetween(today, day) > 0) return { ok: false, field: "day", message: "Pick today or an earlier date." };
  if (day < addDays(today, -MAX_DAYS_BACK)) {
    return { ok: false, field: "day", message: "Pick a date from the last year." };
  }
  return { ok: true };
}

/** True while a day has room for another added entry. */
export const canAddMore = (entriesOnDay: number): boolean => entriesOnDay < MAX_ENTRIES_PER_DAY;

/**
 * What removing an added entry changes: the total goes down, and nothing else. The stage never moves back
 * and an hour chime that already played never plays again.
 */
export function applyRemoval(state: { stage: Stage; chimedHours: number; watchedSeconds: number; addedMinutes: number }, removedMinutes: number) {
  const addedMinutes = Math.max(0, state.addedMinutes - removedMinutes);
  return {
    stage: state.stage,
    chimedHours: state.chimedHours,
    addedMinutes,
    totalSeconds: totalSeconds(state.watchedSeconds, addedMinutes),
  };
}
