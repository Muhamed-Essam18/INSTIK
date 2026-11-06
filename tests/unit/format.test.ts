import { describe, expect, it } from "vitest";
import { formatClock, formatLength } from "@/lib/player/format";

describe("formatClock", () => {
  it("formats m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(134)).toBe("2:14");
    expect(formatClock(134.9)).toBe("2:14");
    expect(formatClock(3725)).toBe("62:05");
  });

  it("treats NaN, infinity and negatives as 0:00", () => {
    for (const bad of [NaN, Infinity, -5]) expect(formatClock(bad)).toBe("0:00");
  });
});

describe("formatLength", () => {
  it("formats seconds, whole minutes and both", () => {
    expect(formatLength(45)).toBe("45 s");
    expect(formatLength(480)).toBe("8 min");
    expect(formatLength(520)).toBe("8 min 40 s");
    expect(formatLength(61)).toBe("1 min 1 s");
  });
});
