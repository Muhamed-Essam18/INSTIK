import { describe, expect, it } from "vitest";
import { applyRemoval, canAddMore, manualTimeSchema, validateManualTime } from "@/lib/hours/manual-time";

const today = "2026-11-08";
const check = (minutes: unknown, day: unknown = today) => validateManualTime({ minutes, day, today });

describe("validateManualTime", () => {
  it("accepts whole minutes from 1 to 600 on a valid date", () => {
    expect(check(1)).toEqual({ ok: true });
    expect(check(45, "2026-11-07")).toEqual({ ok: true });
    expect(check(600)).toEqual({ ok: true });
  });

  it.each([0, -5, 601, 12.5, NaN, Infinity, "30", null, undefined])("rejects minutes of %s", (bad) => {
    const r = check(bad);
    expect(r).toMatchObject({ ok: false, field: "minutes" });
  });

  it("rejects a date after today in the learner's zone", () => {
    expect(check(30, "2026-11-09")).toMatchObject({ ok: false, field: "day" });
  });

  it("allows today even when UTC's today is a different date (decided from the learner's today)", () => {
    // Learner is already on the 9th; the 9th is today for them.
    expect(validateManualTime({ minutes: 30, day: "2026-11-09", today: "2026-11-09" })).toEqual({ ok: true });
    // And one still on the 8th may not enter the 9th.
    expect(validateManualTime({ minutes: 30, day: "2026-11-09", today: "2026-11-08" })).toMatchObject({ ok: false });
  });

  it("rejects a date more than 365 days back and accepts exactly 365", () => {
    expect(check(30, "2025-11-08")).toEqual({ ok: true });
    expect(check(30, "2025-11-07")).toMatchObject({ ok: false, field: "day" });
    expect(check(30, "2024-01-01")).toMatchObject({ ok: false, field: "day" });
  });

  it.each(["", "yesterday", "2026-13-01", "2026-02-30", null])("rejects the date %s", (bad) => {
    expect(check(30, bad)).toMatchObject({ ok: false, field: "day" });
  });

  it("uses short, kind messages", () => {
    const r = check(0);
    expect(r.ok === false && r.message).toBe("Enter a whole number of minutes, from 1 to 600.");
  });
});

describe("canAddMore", () => {
  it("allows at most 20 entries per day", () => {
    expect(canAddMore(0)).toBe(true);
    expect(canAddMore(19)).toBe(true);
    expect(canAddMore(20)).toBe(false);
  });
});

describe("manualTimeSchema", () => {
  const ok = { languageCode: "arz", minutes: 30, day: today, timeZone: "Africa/Cairo" };
  it("accepts a good request and rejects bad shapes", () => {
    expect(manualTimeSchema.safeParse(ok).success).toBe(true);
    expect(manualTimeSchema.safeParse({ ...ok, minutes: 0 }).success).toBe(false);
    expect(manualTimeSchema.safeParse({ ...ok, minutes: 1.5 }).success).toBe(false);
    expect(manualTimeSchema.safeParse({ ...ok, day: "nope" }).success).toBe(false);
    expect(manualTimeSchema.safeParse({ ...ok, languageCode: "" }).success).toBe(false);
  });
});

describe("applyRemoval (FR-009b)", () => {
  it("lowers the total but keeps the stage and the chimed hours", () => {
    const result = applyRemoval({ stage: "FOLLOW_IT", chimedHours: 3, watchedSeconds: 7200, addedMinutes: 120 }, 90);
    expect(result.stage).toBe("FOLLOW_IT");
    expect(result.chimedHours).toBe(3);
    expect(result.addedMinutes).toBe(30);
    expect(result.totalSeconds).toBe(7200 + 30 * 60);
  });

  it("never goes below zero added minutes", () => {
    expect(applyRemoval({ stage: "HEAR_IT", chimedHours: 0, watchedSeconds: 0, addedMinutes: 10 }, 50).totalSeconds).toBe(0);
  });
});
