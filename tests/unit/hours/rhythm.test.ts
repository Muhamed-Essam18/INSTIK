import { describe, expect, it } from "vitest";
import { addDays, localDay, mondayOf } from "@/lib/hours/days";
import { buildRhythm, rhythmStart, weekStrip } from "@/lib/hours/rhythm";

const today = "2026-11-11"; // a Wednesday

describe("buildRhythm", () => {
  it("is always 8 columns of 7 days, Monday first, ending with the current week", () => {
    const r = buildRhythm({ today, watchedByDay: {}, addedDays: [] });
    expect(r.weeks).toHaveLength(8);
    for (const week of r.weeks) expect(week).toHaveLength(7);
    expect(r.weeks[7][0].day).toBe(mondayOf(today));
    expect(r.weeks[7][6].day).toBe("2026-11-15");
    expect(r.weeks[0][0].day).toBe(addDays(mondayOf(today), -49));
    expect(rhythmStart(today)).toBe(r.weeks[0][0].day);
  });

  it("calls 59 counted seconds a rest day and 60 a watched day", () => {
    const r = buildRhythm({ today, watchedByDay: { "2026-11-09": 59, "2026-11-10": 60 }, addedDays: [] });
    const flat = r.weeks.flat();
    expect(flat.find((d) => d.day === "2026-11-09")?.state).toBe("rest");
    expect(flat.find((d) => d.day === "2026-11-10")?.state).toBe("watched");
  });

  it("counts any added time as a watched day", () => {
    const r = buildRhythm({ today, watchedByDay: {}, addedDays: ["2026-11-03"] });
    expect(r.weeks.flat().find((d) => d.day === "2026-11-03")?.state).toBe("watched");
    expect(r.watchedDays).toBe(1);
  });

  it("marks days after today as future, never as rest or missed", () => {
    const r = buildRhythm({ today, watchedByDay: { "2026-11-14": 9999 }, addedDays: [] });
    const flat = r.weeks.flat();
    expect(flat.find((d) => d.day === "2026-11-12")?.state).toBe("future");
    expect(flat.find((d) => d.day === "2026-11-14")?.state).toBe("future");
    expect(flat.filter((d) => d.state === "future")).toHaveLength(4);
  });

  it("flags today", () => {
    const r = buildRhythm({ today, watchedByDay: {}, addedDays: [] });
    expect(r.weeks.flat().filter((d) => d.today).map((d) => d.day)).toEqual([today]);
  });

  it("uses the learner's today, which can differ from UTC's today", () => {
    const instant = Date.parse("2026-11-11T23:30:00Z");
    const learnerToday = localDay(instant, "Pacific/Auckland"); // already the 12th there
    expect(learnerToday).toBe("2026-11-12");
    const r = buildRhythm({ today: learnerToday, watchedByDay: { "2026-11-12": 120 }, addedDays: [] });
    expect(r.weeks.flat().find((d) => d.day === "2026-11-12")).toMatchObject({ state: "watched", today: true });
  });

  it("has no field that counts consecutive days, missed days or losses", () => {
    const r = buildRhythm({ today, watchedByDay: {}, addedDays: [] });
    expect(Object.keys(r).sort()).toEqual(["watchedDays", "weeks"]);
    expect(JSON.stringify(r)).not.toMatch(/streak|missed|lost|broken/i);
  });
});

describe("weekStrip", () => {
  it("returns Monday to Sunday with today marked", () => {
    const strip = weekStrip({ today, watchedByDay: { "2026-11-09": 600 }, addedDays: ["2026-11-10"] });
    expect(strip.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(strip.map((d) => d.state)).toEqual(["watched", "watched", "rest", "future", "future", "future", "future"]);
    expect(strip.find((d) => d.today)?.label).toBe("Wed");
  });

  it("treats today as watched when it has counted time", () => {
    const strip = weekStrip({ today, watchedByDay: { [today]: 1500 }, addedDays: [] });
    expect(strip[2]).toMatchObject({ state: "watched", today: true });
  });
});
