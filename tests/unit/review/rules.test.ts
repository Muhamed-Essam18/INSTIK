import { describe, expect, it } from "vitest";
import { allTicked, approveProblems, daysWaiting, parseChecks, queueBadge, startOfMonth, type Checks } from "@/lib/review/rules";

const ticked: Checks = { stageFits: true, audio: true, realPeople: true, safe: true, transcript: true };
const ready = { status: "IN_REVIEW", checks: ticked, segmentCount: 3, stage: "hear-it", title: "T", topic: "food", durationSeconds: 60, playbackId: "p" };

describe("approveProblems", () => {
  it("passes when everything is there", () => expect(approveProblems(ready)).toEqual([]));
  it("names the checklist", () => expect(approveProblems({ ...ready, checks: { ...ticked, safe: false } })).toEqual(["checklist"]));
  it("names the missing transcript", () => expect(approveProblems({ ...ready, segmentCount: 0 })).toEqual(["no-transcript"]));
  it("names the missing stage", () => expect(approveProblems({ ...ready, stage: null })).toEqual(["no-stage"]));
  it.each([
    ["playback id", { playbackId: null }],
    ["duration", { durationSeconds: null }],
    ["title", { title: " " }],
    ["topic", { topic: null }],
  ])("refuses a video without a %s as not ready", (_name, change) => expect(approveProblems({ ...ready, ...change })).toEqual(["not-ready"]));
  it("refuses anything not In review and says only that", () => {
    expect(approveProblems({ ...ready, status: "CHANGES_REQUESTED", segmentCount: 0 })).toEqual(["not-in-review"]);
  });
  it("lists several problems together", () => expect(approveProblems({ ...ready, checks: parseChecks({}), segmentCount: 0 })).toEqual(["checklist", "no-transcript"]));
});

describe("checks", () => {
  it("reads {} and garbage as unticked", () => {
    for (const bad of [{}, null, "x", 4, [], { stageFits: "yes", audio: 1 }]) expect(allTicked(parseChecks(bad))).toBe(false);
    expect(parseChecks({}).audio).toBe(false);
  });
  it("keeps good keys when others are bad", () => {
    const c = parseChecks({ audio: true, safe: "yes" });
    expect(c.audio).toBe(true);
    expect(c.safe).toBe(false);
  });
  it("all ticked", () => expect(allTicked(ticked)).toBe(true));
});

describe("queueBadge", () => {
  it("is by segment count", () => {
    expect(queueBadge(0)).toBe("Needs review");
    expect(queueBadge(1)).toBe("Transcript in progress");
  });
});

describe("daysWaiting", () => {
  const now = new Date("2026-11-13T10:00:00Z");
  it("same day, 1, many", () => {
    expect(daysWaiting(new Date("2026-11-13T06:00:00Z"), now)).toBe("Today");
    expect(daysWaiting(new Date("2026-11-12T20:00:00Z"), now)).toBe("1 day");
    expect(daysWaiting(new Date("2026-11-09T09:00:00Z"), now)).toBe("4 days");
  });
  it("never negative", () => expect(daysWaiting(new Date("2026-11-14T10:00:00Z"), now)).toBe("Today"));
});

describe("startOfMonth (Europe/Warsaw)", () => {
  it("winter: a month end", () => {
    expect(startOfMonth(new Date("2026-01-31T12:00:00Z")).toISOString()).toBe("2025-12-31T23:00:00.000Z");
    // 23:30 UTC on 31 January is already 1 February in Warsaw.
    expect(startOfMonth(new Date("2026-01-31T23:30:00Z")).toISOString()).toBe("2026-01-31T23:00:00.000Z");
  });
  it("summer (daylight saving): a month end", () => {
    expect(startOfMonth(new Date("2026-07-31T12:00:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(startOfMonth(new Date("2026-07-31T22:30:00Z")).toISOString()).toBe("2026-07-31T22:00:00.000Z");
  });
  it("at the exact Warsaw midnight", () => {
    expect(startOfMonth(new Date("2026-08-31T22:00:00Z")).toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(startOfMonth(new Date("2026-08-31T21:59:59Z")).toISOString()).toBe("2026-07-31T22:00:00.000Z");
  });
  it("across the March clock change", () => {
    expect(startOfMonth(new Date("2026-04-10T00:00:00Z")).toISOString()).toBe("2026-03-31T22:00:00.000Z");
  });
});
