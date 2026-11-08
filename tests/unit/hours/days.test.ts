import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  isDay,
  isValidTimeZone,
  localDay,
  mondayOf,
  splitByLocalDay,
  todayIn,
  weekdayIndex,
} from "@/lib/hours/days";

const at = (iso: string) => Date.parse(iso);
const total = (parts: { seconds: number }[]) => parts.reduce((n, p) => n + p.seconds, 0);

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects other things", () => {
    expect(isValidTimeZone("Africa/Cairo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone("x".repeat(100))).toBe(false);
  });
});

describe("localDay", () => {
  it("uses the learner's zone, not UTC", () => {
    const instant = at("2026-03-10T23:30:00Z");
    expect(localDay(instant, "UTC")).toBe("2026-03-10");
    expect(localDay(instant, "Pacific/Auckland")).toBe("2026-03-11");
    expect(localDay(instant, "America/New_York")).toBe("2026-03-10");
    expect(todayIn("Asia/Kolkata", instant)).toBe("2026-03-11");
  });
});

describe("splitByLocalDay", () => {
  it("returns one entry inside a day", () => {
    expect(splitByLocalDay(at("2026-03-10T12:00:00Z"), 20, "UTC")).toEqual([{ day: "2026-03-10", seconds: 20 }]);
  });

  it("returns nothing for zero or negative seconds", () => {
    expect(splitByLocalDay(at("2026-03-10T12:00:00Z"), 0, "UTC")).toEqual([]);
    expect(splitByLocalDay(at("2026-03-10T12:00:00Z"), -3, "UTC")).toEqual([]);
  });

  it("gives 10 and 10 for 20 seconds starting at 23:59:50 local", () => {
    expect(splitByLocalDay(at("2026-03-10T23:59:50Z"), 20, "UTC")).toEqual([
      { day: "2026-03-10", seconds: 10 },
      { day: "2026-03-11", seconds: 10 },
    ]);
  });

  it.each([
    ["America/New_York", "2026-01-10T04:59:50Z", "2026-01-09", "2026-01-10"],
    ["Africa/Cairo", "2026-01-10T21:59:50Z", "2026-01-10", "2026-01-11"],
    ["Pacific/Auckland", "2026-01-10T10:59:50Z", "2026-01-10", "2026-01-11"],
    ["Asia/Kolkata", "2026-01-10T18:29:50Z", "2026-01-10", "2026-01-11"],
    ["Asia/Kathmandu", "2026-01-10T18:14:50Z", "2026-01-10", "2026-01-11"],
  ])("splits exactly at local midnight in %s", (zone, start, firstDay, secondDay) => {
    const parts = splitByLocalDay(at(start), 20, zone);
    expect(parts).toEqual([
      { day: firstDay, seconds: 10 },
      { day: secondDay, seconds: 10 },
    ]);
    expect(total(parts)).toBe(20);
  });

  it("splits at midnight on a 23-hour DST day (New York, March)", () => {
    // Clocks go forward on 2026-03-08, so that local day is 23 hours long.
    const parts = splitByLocalDay(at("2026-03-08T04:59:50Z"), 20, "America/New_York");
    expect(parts).toEqual([
      { day: "2026-03-07", seconds: 10 },
      { day: "2026-03-08", seconds: 10 },
    ]);
  });

  it("splits at midnight at the end of a 25-hour DST day (New York, November)", () => {
    // Clocks go back on 2026-11-01; local midnight into the 2nd is 2026-11-02T05:00:00Z.
    const parts = splitByLocalDay(at("2026-11-02T04:59:50Z"), 20, "America/New_York");
    expect(parts).toEqual([
      { day: "2026-11-01", seconds: 10 },
      { day: "2026-11-02", seconds: 10 },
    ]);
  });

  it("splits a long interval across several days with the right sum", () => {
    const parts = splitByLocalDay(at("2026-03-10T23:00:00Z"), 3 * 86_400, "UTC");
    expect(parts.map((p) => p.day)).toEqual(["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13"]);
    expect(total(parts)).toBe(3 * 86_400);
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("numbers weekdays from Monday and finds the Monday of a week", () => {
    expect(weekdayIndex("2026-11-09")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-15")).toBe(6); // Sunday
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
  });

  it("counts days between", () => {
    expect(daysBetween("2026-11-01", "2026-11-09")).toBe(8);
    expect(daysBetween("2026-11-09", "2026-11-01")).toBe(-8);
  });

  it("recognises real calendar days only", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("26-02-28")).toBe(false);
    expect(isDay(20260228)).toBe(false);
  });
});
