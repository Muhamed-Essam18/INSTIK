import { describe, expect, it } from "vitest";
import { parseVtt } from "@/lib/content/vtt";
import {
  SEGMENTS_MAX,
  SEGMENT_TEXT_MAX,
  cuesToSegments,
  formatTime,
  mergeImport,
  orderSegments,
  overlapsAny,
  parseTime,
  renumber,
  validateSegment,
  type SegmentInput,
} from "@/lib/review/segments";

const seg = (start: number, end: number, script = "كلام"): SegmentInput => ({ start, end, script, transliteration: "", english: "" });
const ctx = { durationSeconds: 60 };

describe("validateSegment", () => {
  it("accepts a good segment", () => expect(validateSegment(seg(1, 4), ctx)).toEqual([]));
  it("needs start before end", () => {
    expect(validateSegment(seg(4, 4), ctx).map((p) => p.field)).toEqual(["end"]);
    expect(validateSegment(seg(5, 2), ctx).map((p) => p.field)).toEqual(["end"]);
  });
  it("stays within the duration when it is known", () => {
    expect(validateSegment(seg(50, 61), ctx).map((p) => p.field)).toEqual(["end"]);
    expect(validateSegment(seg(50, 61), { durationSeconds: null })).toEqual([]);
    expect(validateSegment(seg(50, 60), ctx)).toEqual([]);
  });
  it("needs the script", () => expect(validateSegment(seg(1, 2, "  "), ctx).map((p) => p.field)).toEqual(["script"]));
  it("limits every text field to 1,000 characters", () => {
    const long = "ا".repeat(SEGMENT_TEXT_MAX + 1);
    expect(validateSegment({ ...seg(1, 2), script: long }, ctx).map((p) => p.field)).toEqual(["script"]);
    expect(validateSegment({ ...seg(1, 2), english: long }, ctx).map((p) => p.field)).toEqual(["english"]);
    expect(validateSegment({ ...seg(1, 2), script: "ا".repeat(SEGMENT_TEXT_MAX) }, ctx)).toEqual([]);
  });
  it("refuses a negative or non-finite time", () => {
    expect(validateSegment(seg(-1, 2), ctx).map((p) => p.field)).toContain("start");
    expect(validateSegment(seg(1, Number.NaN), ctx).map((p) => p.field)).toContain("end");
  });
});

describe("overlap, order and positions", () => {
  const rows = [
    { id: "a", start: 0, end: 5, position: 1 },
    { id: "b", start: 5, end: 9, position: 2 },
  ];
  it("treats touching ends as fine and real overlap as not", () => {
    expect(overlapsAny(rows, { start: 9, end: 12 })).toBe(false);
    expect(overlapsAny(rows, { start: 4, end: 6 })).toBe(true);
    expect(overlapsAny(rows, { start: 4.5, end: 5 }, "a")).toBe(false);
    expect(overlapsAny(rows, { start: 4.5, end: 5.5 }, "a")).toBe(true);
  });
  it("orders by start time", () => expect(orderSegments([seg(9, 10), seg(1, 2)]).map((s) => s.start)).toEqual([1, 9]));
  it("renumbers by start time and returns only what changed", () => {
    expect(renumber(rows)).toEqual([]);
    expect(renumber([{ id: "a", start: 8, end: 9, position: 1 }, { id: "b", start: 1, end: 2, position: 2 }])).toEqual([
      { id: "b", position: 1 },
      { id: "a", position: 2 },
    ]);
  });
});

describe("times", () => {
  it("formats m:ss and h:mm:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(4.5)).toBe("0:04.5");
    expect(formatTime(3725)).toBe("1:02:05");
  });
  it("parses what the editor shows and plain seconds", () => {
    expect(parseTime("1:05")).toBe(65);
    expect(parseTime("0:04.5")).toBe(4.5);
    expect(parseTime("1:02:05")).toBe(3725);
    expect(parseTime("65")).toBe(65);
    expect(parseTime("")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("1:75")).toBeNull();
  });
});

describe("cuesToSegments", () => {
  it("joins lines with a space, strips tags and puts the text in the Arabic field", () => {
    const { cues, errors } = parseVtt("WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nالدُّنْيا <i>بِتْمَطَّر</i>\nالنَّهارده\n\n00:00:05.000 --> 00:00:06.500\nدي شَمْسِيَّة\n");
    expect(errors).toEqual([]);
    expect(cuesToSegments(cues)).toEqual([
      { start: 1, end: 4, script: "الدُّنْيا بِتْمَطَّر النَّهارده", transliteration: "", english: "" },
      { start: 5, end: 6.5, script: "دي شَمْسِيَّة", transliteration: "", english: "" },
    ]);
  });
  it("shows line numbers for a malformed file and refuses it", () => {
    const { errors } = parseVtt("WEBVTT\n\n00:00:04.000 --> 00:00:01.000\nx\n");
    expect(errors[0]).toMatch(/^line 3:/);
    expect(parseVtt("hello").errors[0]).toMatch(/^line 1:/);
  });
});

describe("mergeImport", () => {
  const existing = [seg(0, 5), seg(10, 15)];
  it("replace keeps only the imported segments", () => {
    const r = mergeImport(existing, [seg(1, 2), seg(3, 4)], "replace", ctx);
    expect(r).toEqual({ ok: true, segments: [seg(1, 2), seg(3, 4)] });
  });
  it("add keeps the existing ones too, in order", () => {
    const r = mergeImport(existing, [seg(6, 8)], "add", ctx);
    expect(r.ok && r.segments.map((s) => s.start)).toEqual([0, 6, 10]);
  });
  it("add refuses overlap with an existing segment and says where", () => {
    const r = mergeImport(existing, [seg(4, 8)], "add", ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems.join(" ")).toMatch(/overlap/);
  });
  it("replace accepts what add would refuse", () => expect(mergeImport(existing, [seg(4, 8)], "replace", ctx).ok).toBe(true));
  it("refuses a segment past the end of the video", () => expect(mergeImport([], [seg(50, 99)], "replace", ctx).ok).toBe(false));
  it("refuses more than 2,000 segments", () => {
    const many = Array.from({ length: SEGMENTS_MAX + 1 }, (_, i) => seg(i, i + 0.5));
    const r = mergeImport([], many, "replace", { durationSeconds: null });
    expect(!r.ok && r.problems[0]).toMatch(/2,000/);
  });
});
