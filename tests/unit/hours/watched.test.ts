import { describe, expect, it } from "vitest";
import { clampPosition, isWatched } from "@/lib/hours/watched";

describe("isWatched", () => {
  it("is true at 90% and beyond, and at the end", () => {
    expect(isWatched(540, 600)).toBe(true);
    expect(isWatched(599, 600)).toBe(true);
    expect(isWatched(600, 600)).toBe(true);
    expect(isWatched(700, 600)).toBe(true);
  });

  it("is false below 90%", () => {
    expect(isWatched(539, 600)).toBe(false);
    expect(isWatched(0, 600)).toBe(false);
  });

  it("is never true for an unknown or zero duration", () => {
    expect(isWatched(10, 0)).toBe(false);
    expect(isWatched(10, NaN)).toBe(false);
    expect(isWatched(Infinity, 600)).toBe(false);
  });

  it("stays true once true", () => {
    expect(isWatched(3, 600, true)).toBe(true);
  });
});

describe("clampPosition", () => {
  it("keeps the position inside the video as a whole second", () => {
    expect(clampPosition(134.9, 600)).toBe(134);
    expect(clampPosition(-4, 600)).toBe(0);
    expect(clampPosition(900, 600)).toBe(600);
    expect(clampPosition(NaN, 600)).toBe(0);
    expect(clampPosition(30, 0)).toBe(0);
  });
});
