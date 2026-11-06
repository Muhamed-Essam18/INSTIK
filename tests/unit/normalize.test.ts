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

import { stripTashkeel } from "@/lib/text/normalize";

describe("stripTashkeel", () => {
  it("removes vowel marks and tatweel", () => {
    expect(stripTashkeel("سُخْنَة")).toBe("سخنة");
    expect(stripTashkeel("كـــافيه")).toBe("كافيه");
    expect(stripTashkeel("ًٰۭٟۖ")).toBe("");
  });

  it("leaves letters and punctuation alone, including the Arabic question mark", () => {
    expect(stripTashkeel("فاهم؟ أهلاً!")).toBe("فاهم؟ أهلا!");
  });

  it("does not fold letter variants", () => {
    for (const a of ["أ", "إ", "آ", "ا"]) expect(stripTashkeel(`${a}كل`)).toBe(`${a}كل`);
    expect(stripTashkeel("مدرسة")).toBe("مدرسة");
    expect(stripTashkeel("مستشفى")).toBe("مستشفى");
  });

  it("does not mutate its input", () => {
    const input = "سَلْمَى";
    stripTashkeel(input);
    expect(input).toBe("سَلْمَى");
  });
});
