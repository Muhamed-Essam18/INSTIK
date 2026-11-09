import { describe, expect, it } from "vitest";
import raw from "../../content/languages.json";
import { parseLanguagesFile } from "@/lib/languages.schema";

type Entry = Record<string, unknown> & { fonts: Record<string, unknown> };
const clone = () => structuredClone(raw) as { languages: Entry[] };

function messageFor(data: unknown): string {
  try {
    parseLanguagesFile(data);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected parseLanguagesFile to throw");
}

describe("languages schema", () => {
  it("accepts the shipped file", () => {
    expect(parseLanguagesFile(raw)).toHaveLength(3);
  });

  it("reports a missing field", () => {
    const d = clone();
    delete d.languages[1].direction;
    expect(messageFor(d)).toContain('languages[1]: "direction" is required');
  });

  it("rejects a bad slug", () => {
    const d = clone();
    d.languages[0].slug = "Arabic Egyptian";
    expect(messageFor(d)).toContain('languages[0].slug: "Arabic Egyptian" is not a valid slug');
  });

  it("rejects a bad direction", () => {
    const d = clone();
    d.languages[0].direction = "up";
    expect(messageFor(d)).toContain('languages[0].direction: expected "rtl" or "ltr"');
  });

  it("rejects a bad status", () => {
    const d = clone();
    d.languages[1].status = "later";
    expect(messageFor(d)).toContain('languages[1].status: expected "available" or "coming-soon"');
  });

  it("rejects a bad script", () => {
    const d = clone();
    d.languages[0].script = "cyrillic";
    expect(messageFor(d)).toContain('languages[0].script: expected "arabic" or "latin"');
  });

  it("rejects an unknown font token", () => {
    const d = clone();
    d.languages[0].fonts.ui = "comic";
    expect(messageFor(d)).toContain("languages[0].fonts.ui: unknown font token");
  });

  it("rejects a duplicate transcript layer", () => {
    const d = clone();
    d.languages[0].transcriptLayers = ["script", "script"];
    expect(messageFor(d)).toContain('languages[0].transcriptLayers: duplicate "script"');
  });

  it("rejects a duplicate slug", () => {
    const d = clone();
    d.languages[1].slug = "arabic-egyptian";
    expect(messageFor(d)).toContain('duplicate slug "arabic-egyptian"');
  });

  it("rejects a duplicate code", () => {
    const d = clone();
    d.languages[1].code = "arz";
    expect(messageFor(d)).toContain('duplicate code "arz"');
  });

  it("requires at least one available language", () => {
    const d = clone();
    d.languages[0].status = "coming-soon";
    expect(messageFor(d)).toContain("at least one language must be available");
  });

  it("rejects an empty languages array", () => {
    expect(messageFor({ languages: [] })).toContain('expected a non-empty "languages" array');
  });

  it("rejects a missing languages array", () => {
    expect(messageFor({})).toContain('expected a non-empty "languages" array');
  });
});
