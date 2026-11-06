import { describe, expect, it } from "vitest";
import { buildGlossaryIndex, linkWords } from "@/lib/content/glossary-link";

const entry = (id: string, word: string) => ({ id, word, base: word, transliteration: id, english: id });

const index = buildGlossaryIndex([
  entry("sokhna", "سُخْنَة"),
  entry("ahwa", "القَهْوَة"),
  entry("min-fadlak", "مِن فَضْلَك"),
  entry("min", "مِن"),
  entry("alef", "أكل"),
]).index;

const link = (script: string) => linkWords(script, index);
const joined = (script: string) => link(script).map((s) => s.text).join("");

describe("linkWords", () => {
  it("links a word that has an entry and leaves other words as plain text", () => {
    expect(link("دي قَهْوَة سُخْنَة")).toEqual([
      { text: "دي قَهْوَة " },
      { text: "سُخْنَة", entryId: "sokhna" },
    ]);
  });

  it("matches ignoring tashkeel in either side", () => {
    expect(link("سخنة")).toEqual([{ text: "سخنة", entryId: "sokhna" }]);
    expect(link("القهوة")).toEqual([{ text: "القهوة", entryId: "ahwa" }]);
  });

  it("keeps punctuation outside the linked word", () => {
    expect(link("القَهْوَة سُخْنَة.")).toEqual([
      { text: "القَهْوَة", entryId: "ahwa" },
      { text: " " },
      { text: "سُخْنَة", entryId: "sokhna" },
      { text: "." },
    ]);
    expect(link("سخنة؟")).toEqual([
      { text: "سخنة", entryId: "sokhna" },
      { text: "؟" },
    ]);
    expect(link("«سخنة»").map((s) => s.entryId)).toEqual([undefined, "sokhna", undefined]);
  });

  it("prefers the longest multi-word entry", () => {
    expect(link("مِن فَضْلَك.")).toEqual([
      { text: "مِن فَضْلَك", entryId: "min-fadlak" },
      { text: "." },
    ]);
    expect(link("مِن هنا")).toEqual([
      { text: "مِن", entryId: "min" },
      { text: " هنا" },
    ]);
  });

  it("does not join a phrase across punctuation", () => {
    expect(link("مِن، فَضْلَك").some((s) => s.entryId === "min-fadlak")).toBe(false);
  });

  it("links every occurrence of a repeated word", () => {
    expect(link("سخنة سخنة").filter((s) => s.entryId === "sokhna")).toHaveLength(2);
  });

  it("does not fold letter variants", () => {
    expect(link("اكل").some((s) => s.entryId)).toBe(false);
    expect(link("أكل").some((s) => s.entryId === "alef")).toBe(true);
  });

  it("preserves every character: joining the segments gives the original line", () => {
    for (const line of ["دي قَهْوَة. القَهْوَة سُخْنَة؟", "  مِن فَضْلَك  ", "سخنة سخنة", "", "-"]) {
      expect(joined(line)).toBe(line);
    }
  });
});

describe("buildGlossaryIndex", () => {
  it("fails on two entries with the same text once tashkeel is removed, naming both ids", () => {
    const { errors } = buildGlossaryIndex([entry("a", "سُخْنَة"), entry("b", "سَخْنَة")]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/ambiguous/);
    expect(errors[0]).toContain('"a"');
    expect(errors[0]).toContain('"b"');
  });

  it("does not treat different letters as ambiguous", () => {
    expect(buildGlossaryIndex([entry("a", "أكل"), entry("b", "اكل")]).errors).toEqual([]);
  });
});
