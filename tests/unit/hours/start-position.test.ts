import { describe, expect, it } from "vitest";
import { startPosition } from "@/lib/player/start-position";

describe("startPosition", () => {
  it("returns a valid whole-second position", () => {
    expect(startPosition("134", 600)).toBe(134);
    expect(startPosition("134.9", 600)).toBe(134);
    expect(startPosition(" 5 ", 600)).toBe(5);
  });

  it.each([null, undefined, "", "abc", "-5", "NaN", "Infinity", "1e3", "12px", "0", "0.4"])(
    "gives 0 for %s",
    (bad) => {
      expect(startPosition(bad as string | null | undefined, 600)).toBe(0);
    },
  );

  it("ignores a position at or beyond the duration", () => {
    expect(startPosition("600", 600)).toBe(0);
    expect(startPosition("900", 600)).toBe(0);
    expect(startPosition("599", 600)).toBe(599);
  });

  it("accepts a position while the duration is still unknown", () => {
    expect(startPosition("30", NaN)).toBe(30);
    expect(startPosition("30", 0)).toBe(30);
  });
});
