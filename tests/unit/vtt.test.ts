import { describe, expect, it } from "vitest";
import { parseVtt } from "@/lib/content/vtt";

const valid = `WEBVTT

NOTE sample

00:00:02.000 --> 00:00:05.500
أهلا

00:05.500 --> 00:08.000
ازيك؟
`;

describe("parseVtt", () => {
  it("parses cues and ignores NOTE blocks", () => {
    const { cues, errors } = parseVtt(valid);
    expect(errors).toEqual([]);
    expect(cues).toEqual([
      { start: 2, end: 5.5, text: "أهلا", line: 5 },
      { start: 5.5, end: 8, text: "ازيك؟", line: 8 },
    ]);
  });

  it("requires the WEBVTT header", () => {
    expect(parseVtt("00:00.000 --> 00:01.000\nhi").errors[0]).toMatch(/line 1.*WEBVTT/);
  });

  it("rejects malformed timestamps", () => {
    expect(parseVtt("WEBVTT\n\n00:00 --> 00:01.000\nhi").errors[0]).toMatch(/line 3.*timestamp/);
  });

  it("rejects a cue that ends before it starts", () => {
    expect(parseVtt("WEBVTT\n\n00:05.000 --> 00:01.000\nhi").errors[0]).toMatch(/end after/);
  });

  it("rejects cues out of order or overlapping", () => {
    const text = "WEBVTT\n\n00:00:05.000 --> 00:00:08.000\na\n\n00:00:06.000 --> 00:00:09.000\nb\n";
    expect(parseVtt(text).errors[0]).toMatch(/line 6.*previous/);
  });

  it("rejects empty cue text", () => {
    expect(parseVtt("WEBVTT\n\n00:00.000 --> 00:01.000\n").errors[0]).toMatch(/empty/);
  });
});
