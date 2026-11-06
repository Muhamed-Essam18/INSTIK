import { describe, expect, it } from "vitest";
import { findCueIndex } from "@/lib/player/cue-index";

const cues = [{ start: 2 }, { start: 5 }, { start: 9.5 }];

describe("findCueIndex", () => {
  it("is -1 for an empty list and before the first cue", () => {
    expect(findCueIndex([], 3)).toBe(-1);
    expect(findCueIndex(cues, 0)).toBe(-1);
    expect(findCueIndex(cues, 1.999)).toBe(-1);
  });

  it("includes the exact start", () => {
    expect(findCueIndex(cues, 2)).toBe(0);
    expect(findCueIndex(cues, 5)).toBe(1);
    expect(findCueIndex(cues, 9.5)).toBe(2);
  });

  it("keeps the previous cue during gaps and the last cue after the end", () => {
    expect(findCueIndex(cues, 4.99)).toBe(0);
    expect(findCueIndex(cues, 7)).toBe(1);
    expect(findCueIndex(cues, 9999)).toBe(2);
  });

  it("works for one cue and for many", () => {
    expect(findCueIndex([{ start: 1 }], 0.5)).toBe(-1);
    expect(findCueIndex([{ start: 1 }], 1)).toBe(0);
    const many = Array.from({ length: 500 }, (_, i) => ({ start: i * 2 }));
    for (const t of [0, 1.99, 2, 499, 998, 999.9, 5000]) {
      const expected = Math.min(499, Math.floor(t / 2));
      expect(findCueIndex(many, t)).toBe(expected);
    }
  });
});
