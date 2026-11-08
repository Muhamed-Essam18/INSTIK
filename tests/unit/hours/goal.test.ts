import { describe, expect, it } from "vitest";
import { blocksReached, decideDone, effectiveDoneBlocks, shouldShowDone } from "@/lib/hours/goal";

const goal = 20 * 60;

describe("shouldShowDone", () => {
  it("is true exactly when today covers one more block than acknowledged", () => {
    expect(shouldShowDone(goal - 1, goal, 0)).toBe(false);
    expect(shouldShowDone(goal, goal, 0)).toBe(true);
    expect(shouldShowDone(goal, goal, 1)).toBe(false);
    expect(shouldShowDone(2 * goal - 1, goal, 1)).toBe(false);
    expect(shouldShowDone(2 * goal, goal, 1)).toBe(true);
  });

  it("is false for a goal of zero or bad input", () => {
    expect(shouldShowDone(5000, 0, 0)).toBe(false);
    expect(shouldShowDone(NaN, goal, 0)).toBe(false);
  });
});

describe("blocksReached and effectiveDoneBlocks", () => {
  it("counts whole blocks", () => {
    expect(blocksReached(goal * 2 + 5, goal)).toBe(2);
    expect(blocksReached(0, goal)).toBe(0);
    expect(blocksReached(100, 0)).toBe(0);
  });

  it("resets on a new local day", () => {
    expect(effectiveDoneBlocks("2026-11-08", "2026-11-08", 2)).toBe(2);
    expect(effectiveDoneBlocks("2026-11-07", "2026-11-08", 2)).toBe(0);
    expect(effectiveDoneBlocks(null, "2026-11-08", 2)).toBe(0);
  });
});

describe("decideDone", () => {
  const base = {
    position: 600,
    duration: 600,
    todaySeconds: goal,
    goalSeconds: goal,
    doneDay: null as string | null,
    doneBlocks: 0,
    today: "2026-11-08",
  };

  it("shows after the video ends once the goal is reached, and records the block", () => {
    expect(decideDone(base)).toEqual({ show: true, doneBlocks: 1 });
  });

  it("never shows when the video has not reached its last 10% (mid-video)", () => {
    expect(decideDone({ ...base, position: 100 })).toEqual({ show: false, doneBlocks: 0 });
  });

  it("does not show before the goal", () => {
    expect(decideDone({ ...base, todaySeconds: goal - 30 })).toEqual({ show: false, doneBlocks: 0 });
  });

  it("does not show again for an acknowledged block, but does after a further full block", () => {
    const acknowledged = { ...base, doneDay: "2026-11-08", doneBlocks: 1 };
    expect(decideDone({ ...acknowledged, todaySeconds: goal + 600 })).toEqual({ show: false, doneBlocks: 1 });
    expect(decideDone({ ...acknowledged, todaySeconds: 2 * goal })).toEqual({ show: true, doneBlocks: 2 });
  });

  it("starts again on a new day", () => {
    expect(decideDone({ ...base, doneDay: "2026-11-07", doneBlocks: 3 })).toEqual({ show: true, doneBlocks: 1 });
  });

  it("records the floor of blocks when several were passed in one long video", () => {
    expect(decideDone({ ...base, todaySeconds: goal * 2 + 100 })).toEqual({ show: true, doneBlocks: 2 });
  });
});
