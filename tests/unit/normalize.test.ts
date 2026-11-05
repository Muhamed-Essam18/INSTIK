import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "@/lib/text/normalize";

describe("normalizeForSearch", () => {
  it("removes tashkeel", () => {
    expect(normalizeForSearch("إِزَّيَّك")).toBe("ازيك");
    expect(normalizeForSearch("ًٰۭٟۖ")).toBe("");
  });

  it("removes tatweel", () => {
    expect(normalizeForSearch("كـــافيه")).toBe("كافيه");
  });

  it("folds alef variants", () => {
    for (const a of ["أ", "إ", "آ", "ٱ", "ا"]) expect(normalizeForSearch(`${a}كل`)).toBe("اكل");
  });

  it("folds alef maksura and ta marbuta", () => {
    expect(normalizeForSearch("مستشفى")).toBe(normalizeForSearch("مستشفي"));
    expect(normalizeForSearch("مدرسة")).toBe(normalizeForSearch("مدرسه"));
  });

  it("folds Latin accents and case", () => {
    expect(normalizeForSearch("Café")).toBe("cafe");
  });

  it("collapses and trims whitespace", () => {
    expect(normalizeForSearch("  at   the \n café ")).toBe("at the cafe");
  });

  it("returns an empty string for only-tashkeel input", () => {
    expect(normalizeForSearch("َُ")).toBe("");
  });

  it("does not mutate its input", () => {
    const input = "سَلْمَى";
    normalizeForSearch(input);
    expect(input).toBe("سَلْمَى");
  });
});
