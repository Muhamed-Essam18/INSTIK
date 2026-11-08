import { describe, expect, it } from "vitest";
import {
  formatHours,
  formatMinutes,
  hoursOf,
  spokenHours,
  splitHoursMinutes,
  todaySeconds,
  totalSeconds,
  videosToday,
} from "@/lib/hours/totals";

describe("totals", () => {
  it("adds watched seconds and added minutes, keeping seconds", () => {
    expect(totalSeconds(125, 45)).toBe(125 + 2700);
    expect(totalSeconds(0, 0)).toBe(0);
    expect(totalSeconds(-5, -2)).toBe(0);
  });

  it("splits into hours and minutes and drops sub-minute remainders only for display", () => {
    expect(splitHoursMinutes(45_600)).toEqual({ hours: 12, minutes: 40 });
    expect(splitHoursMinutes(59)).toEqual({ hours: 0, minutes: 0 });
    expect(totalSeconds(59, 0) + totalSeconds(59, 0)).toBe(118);
    expect(formatHours(118)).toBe("0h 1m");
  });

  it("formats hours", () => {
    expect(formatHours(45_600)).toBe("12h 40m");
    expect(formatHours(0)).toBe("0h 0m");
    expect(formatHours(3600)).toBe("1h 0m");
  });

  it("formats minutes for the Done screen", () => {
    expect(formatMinutes(24 * 60 + 30)).toBe("24 min");
    expect(formatMinutes(0)).toBe("0 min");
  });

  it("gives hours as a number and a spoken form", () => {
    expect(hoursOf(5400)).toBe(1.5);
    expect(spokenHours(45_600)).toBe("12 hours 40 minutes");
    expect(spokenHours(3660)).toBe("1 hour 1 minute");
  });

  it("counts today's watching only, never time added from outside Instik", () => {
    const rows = [
      { videoSlug: "a", day: "2026-11-08", seconds: 600 },
      { videoSlug: "b", day: "2026-11-08", seconds: 300 },
      { videoSlug: "a", day: "2026-11-07", seconds: 900 },
    ];
    expect(todaySeconds(rows, "2026-11-08")).toBe(900);
    expect(todaySeconds([], "2026-11-08")).toBe(0);
  });

  it("counts distinct videos with counted time today", () => {
    const rows = [
      { videoSlug: "a", day: "2026-11-08", seconds: 10 },
      { videoSlug: "a", day: "2026-11-08", seconds: 20 },
      { videoSlug: "b", day: "2026-11-08", seconds: 0 },
      { videoSlug: "c", day: "2026-11-07", seconds: 99 },
    ];
    expect(videosToday(rows, "2026-11-08")).toBe(1);
  });
});
