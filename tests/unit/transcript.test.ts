import { describe, expect, it } from "vitest";
import { parseTranscript } from "@/lib/content/transcript";
import type { Cue } from "@/lib/content/vtt";

const arabicLayers = ["script", "tashkeel", "transliteration", "english"];
const cue = (text: string, start = 1, line = 3): Cue => ({ start, end: start + 2, text, line });

describe("parseTranscript", () => {
  it("splits a three-line cue into script, transliteration and English", () => {
    const { lines, errors } = parseTranscript(arabicLayers, [cue("سُخْنَة\nsokhna\nhot", 2)]);
    expect(errors).toEqual([]);
    expect(lines).toEqual([{ start: 2, end: 4, script: "سُخْنَة", transliteration: "sokhna", english: "hot" }]);
  });

  it("turns a single dash into null for transliteration and English", () => {
    const { lines } = parseTranscript(arabicLayers, [cue("سخنة\n-\n-")]);
    expect(lines[0].transliteration).toBeNull();
    expect(lines[0].english).toBeNull();
  });

  it("reports the wrong number of lines with the cue's line number", () => {
    const { errors } = parseTranscript(arabicLayers, [cue("سخنة\nsokhna", 1, 7)]);
    expect(errors).toEqual(["line 7: expected 3 lines (script, transliteration, english), found 2"]);
    expect(parseTranscript(arabicLayers, [cue("a\nb\nc\nd", 1, 9)]).errors[0]).toMatch(/line 9: expected 3 lines.*found 4/);
  });

  it("rejects an empty or dash script line", () => {
    expect(parseTranscript(arabicLayers, [cue("-\nx\ny", 1, 5)]).errors[0]).toMatch(/line 5: .*script/);
    expect(parseTranscript(arabicLayers, [cue("  \nx\ny", 1, 5)]).errors.length).toBeGreaterThan(0);
  });

  it("expects as many lines as the language has non-derived layers", () => {
    const spanish = ["script", "english"];
    const ok = parseTranscript(spanish, [cue("Hola\nHello")]);
    expect(ok.errors).toEqual([]);
    expect(ok.lines[0]).toMatchObject({ script: "Hola", transliteration: null, english: "Hello" });
    expect(parseTranscript(spanish, [cue("Hola\nx\nHello", 1, 4)]).errors[0]).toMatch(/expected 2 lines \(script, english\), found 3/);
  });

  it("keeps cue order and times", () => {
    const { lines } = parseTranscript(arabicLayers, [cue("a\nb\nc", 1), cue("d\ne\nf", 4)]);
    expect(lines.map((l) => l.start)).toEqual([1, 4]);
  });
});
