import { describe, expect, it } from "vitest";
import { bucketByWeek, lastFiveWeeks } from "@/lib/earnings/months";

// The dashboard's five weeks (spec 11 FR-010): Monday-based, Warsaw time, the current week marked in progress.

describe("lastFiveWeeks", () => {
  it("returns five Monday-starting weeks, oldest first, with the current one marked", () => {
    const weeks = lastFiveWeeks(new Date("2026-11-11T12:00:00Z")); // a Wednesday
    expect(weeks.map((w) => w.start)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(weeks.map((w) => w.end)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08", "2026-11-15"]);
    expect(weeks.map((w) => w.current)).toEqual([false, false, false, false, true]);
    expect(weeks.map((w) => w.label)).toEqual(["Oct 12", "Oct 19", "Oct 26", "Nov 2", "Nov 9"]);
  });

  it("keeps a Sunday late evening in the week that is ending", () => {
    // 22:30 UTC on Sunday 15 November is 23:30 in Warsaw: still Sunday, still the week of 9 November.
    expect(lastFiveWeeks(new Date("2026-11-15T22:30:00Z")).at(-1)!.start).toBe("2026-11-09");
    // 23:30 UTC is already Monday 16 November in Warsaw.
    expect(lastFiveWeeks(new Date("2026-11-15T23:30:00Z")).at(-1)!.start).toBe("2026-11-16");
  });

  it("is on a Monday for the first moment of the week", () => {
    expect(lastFiveWeeks(new Date("2026-11-08T23:00:00Z")).at(-1)!.start).toBe("2026-11-09");
  });

  it("covers the week the clocks change (the last Sunday of October)", () => {
    const weeks = lastFiveWeeks(new Date("2026-10-28T12:00:00Z"));
    expect(weeks.at(-1)).toMatchObject({ start: "2026-10-26", end: "2026-11-01", current: true });
    expect(weeks.at(-2)).toMatchObject({ start: "2026-10-19", end: "2026-10-25" });
  });

  it("crosses a year end", () => {
    const weeks = lastFiveWeeks(new Date("2027-01-06T12:00:00Z"));
    expect(weeks.map((w) => w.start)).toEqual(["2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28", "2027-01-04"]);
  });
});

describe("bucketByWeek", () => {
  const weeks = lastFiveWeeks(new Date("2026-11-11T12:00:00Z"));

  it("sums each day's counted views into the week that holds it", () => {
    const days = [
      { day: "2026-10-12", count: 5 },
      { day: "2026-10-18", count: 7 },
      { day: "2026-10-19", count: 1 },
      { day: "2026-11-09", count: 4 },
      { day: "2026-11-11", count: 6 },
    ];
    expect(bucketByWeek(days, weeks)).toEqual([12, 1, 0, 0, 10]);
  });

  it("ignores days outside the five weeks and gives zeros for no views", () => {
    expect(bucketByWeek([{ day: "2026-09-01", count: 99 }, { day: "2026-11-20", count: 3 }], weeks)).toEqual([0, 0, 0, 0, 0]);
    expect(bucketByWeek([], weeks)).toEqual([0, 0, 0, 0, 0]);
  });
});
