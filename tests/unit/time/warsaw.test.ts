import { describe, expect, it } from "vitest";
import { hasMonthEnded, isMonthKey, monthKeyOf, monthRange, nextMonth, previousMonth, startOfMonth, warsawDayOf } from "@/lib/time/warsaw";

// Months follow Europe/Warsaw: UTC+1 in winter, UTC+2 in summer (spec 11 FR-036).

describe("month keys", () => {
  it("accepts YYYY-MM and nothing else", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-11-01")).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
  });

  it("moves to the next and previous month across a year end", () => {
    expect(nextMonth("2026-11")).toBe("2026-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(previousMonth("2026-03")).toBe("2026-02");
  });
});

describe("monthRange", () => {
  it("starts at Warsaw midnight in winter (UTC+1)", () => {
    expect(monthRange("2026-01").start.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(monthRange("2026-01").end.toISOString()).toBe("2026-01-31T23:00:00.000Z");
  });

  it("starts at Warsaw midnight in summer (UTC+2)", () => {
    expect(monthRange("2026-07").start.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(monthRange("2026-07").end.toISOString()).toBe("2026-07-31T22:00:00.000Z");
  });

  it("handles the months where the clocks change (March and October)", () => {
    // Clocks go forward on the last Sunday of March (29 March 2026): March starts in winter time, ends in summer time.
    expect(monthRange("2026-03").start.toISOString()).toBe("2026-02-28T23:00:00.000Z");
    expect(monthRange("2026-03").end.toISOString()).toBe("2026-03-31T22:00:00.000Z");
    // Clocks go back on the last Sunday of October (25 October 2026).
    expect(monthRange("2026-10").start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(monthRange("2026-10").end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("goes from December to January", () => {
    expect(monthRange("2026-12").end.toISOString()).toBe(monthRange("2027-01").start.toISOString());
  });

  it("covers February in a leap year and a normal year", () => {
    const days = (key: string) => Math.round((monthRange(key).end.getTime() - monthRange(key).start.getTime()) / 86_400_000);
    expect(days("2028-02")).toBe(29);
    expect(days("2026-02")).toBe(28);
  });

  it("has no gap or overlap between neighbouring months", () => {
    for (const key of ["2026-02", "2026-03", "2026-09", "2026-10", "2026-11"]) {
      expect(monthRange(key).end.getTime()).toBe(monthRange(nextMonth(key)).start.getTime());
    }
  });
});

describe("monthKeyOf and warsawDayOf", () => {
  it("puts 23:30 UTC on the last day of a month into the next Warsaw month", () => {
    expect(monthKeyOf(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12");
    expect(warsawDayOf(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12-01");
  });

  it("keeps the last Warsaw second of a month in that month", () => {
    expect(monthKeyOf(new Date("2026-11-30T22:59:59Z"))).toBe("2026-11");
    expect(monthKeyOf(new Date("2026-11-30T23:00:00Z"))).toBe("2026-12");
  });

  it("uses summer time in July", () => {
    expect(monthKeyOf(new Date("2026-06-30T21:59:59Z"))).toBe("2026-06");
    expect(monthKeyOf(new Date("2026-06-30T22:00:00Z"))).toBe("2026-07");
  });
});

describe("startOfMonth", () => {
  it("is the first Warsaw instant of the month containing now", () => {
    expect(startOfMonth(new Date("2026-01-31T12:00:00Z")).toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(startOfMonth(new Date("2026-07-15T12:00:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });
});

describe("hasMonthEnded", () => {
  it("is false until the first instant of the next month in Warsaw", () => {
    expect(hasMonthEnded("2026-11", new Date("2026-11-30T22:59:59Z"))).toBe(false);
    expect(hasMonthEnded("2026-11", new Date("2026-11-30T23:00:00Z"))).toBe(true);
    expect(hasMonthEnded("2026-11", new Date("2026-12-15T12:00:00Z"))).toBe(true);
  });
});
