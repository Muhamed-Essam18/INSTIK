import { describe, expect, it } from "vitest";
import { validateLanguageContent, type RawContent } from "@/lib/content/validate";

const video = (slug: string, extra: Record<string, unknown> = {}) => ({
  file: `videos/${slug}.json`,
  data: {
    title: slug,
    slug,
    stage: "hear-it",
    topic: "food",
    host: "salma",
    durationSeconds: 300,
    access: "free",
    playbackId: "p",
    ...extra,
  },
});
const host = (slug: string, order: number, extra: Record<string, unknown> = {}) => ({
  file: `hosts/${slug}.json`,
  data: { slug, name: slug, nameArabic: "سلمى", story: "Hi", topics: ["Food"], order, ...extra },
});
const base = (): RawContent => ({
  videos: [video("one"), video("two")],
  hosts: [host("salma", 1), host("omar", 2)],
  transcripts: [{ file: "videos/one.vtt", text: "WEBVTT\n\n00:00.000 --> 00:01.000\nhi\n" }],
  glossary: {
    file: "glossary.json",
    data: { entries: [{ id: "a", word: "w", base: "b", transliteration: "t", english: "e" }] },
  },
});

const check = (raw: RawContent | null, available = true) => () =>
  validateLanguageContent("arabic-egyptian", raw, { available });

describe("validateLanguageContent", () => {
  it("accepts valid content, sorted hosts, video without transcript", () => {
    const result = check(base())();
    expect(result.videos).toHaveLength(2);
    expect(result.hosts.map((h) => h.slug)).toEqual(["salma", "omar"]);
    expect(Object.keys(result.transcripts)).toEqual(["one"]);
  });

  it("names the language folder and the file in every error", () => {
    const raw = base();
    raw.videos = [video("one", { stage: "beginner" })];
    expect(check(raw)).toThrow(/^Invalid content in content\/arabic-egyptian\nvideos\/one\.json: stage: /);
  });

  it("fails on a missing field", () => {
    const raw = base();
    delete (raw.videos[0].data as Record<string, unknown>).title;
    expect(check(raw)).toThrow(/videos\/one\.json: title/);
  });

  it("fails on a bad stage, topic or access", () => {
    for (const bad of [{ stage: "x" }, { topic: "x" }, { access: "x" }]) {
      const raw = base();
      raw.videos = [video("one", bad), video("two")];
      expect(check(raw)).toThrow(/videos\/one\.json/);
    }
  });

  it("fails on an unknown host", () => {
    const raw = base();
    raw.videos = [video("one", { host: "nobody" })];
    expect(check(raw)).toThrow(/unknown host "nobody"/);
  });

  it("fails on duplicate video slugs", () => {
    const raw = base();
    raw.videos = [video("one"), { ...video("one"), file: "videos/copy.json" }];
    expect(check(raw)).toThrow(/duplicate slug "one"/);
  });

  it("fails when slug differs from the file name", () => {
    const raw = base();
    raw.videos = [{ ...video("one"), file: "videos/other.json" }];
    expect(check(raw)).toThrow(/must match the file name "other"/);
  });

  it("fails on duplicate host order and host slug mismatch", () => {
    const raw = base();
    raw.hosts = [host("salma", 1), host("omar", 1)];
    expect(check(raw)).toThrow(/duplicate order 1/);
    raw.hosts = [{ ...host("salma", 1), file: "hosts/wrong.json" }, host("omar", 2)];
    expect(check(raw)).toThrow(/hosts\/wrong\.json: slug/);
  });

  it("fails on a transcript with no video", () => {
    const raw = base();
    raw.transcripts = [{ file: "videos/ghost.vtt", text: "WEBVTT\n" }];
    expect(check(raw)).toThrow(/videos\/ghost\.vtt: video/);
  });

  it("fails on a malformed transcript", () => {
    const raw = base();
    raw.transcripts = [{ file: "videos/one.vtt", text: "no header" }];
    expect(check(raw)).toThrow(/videos\/one\.vtt: transcript: line 1/);
  });

  it("fails on duplicate glossary ids and a malformed glossary", () => {
    const raw = base();
    const entry = { id: "a", word: "w", base: "b", transliteration: "t", english: "e" };
    raw.glossary = { file: "glossary.json", data: { entries: [entry, entry] } };
    expect(check(raw)).toThrow(/glossary\.json: id: duplicate id "a"/);
    raw.glossary = { file: "glossary.json", data: { entries: [{ id: "a" }] } };
    expect(check(raw)).toThrow(/glossary\.json: entries\[0\]/);
    raw.glossary = undefined;
    expect(check(raw)).toThrow(/glossary\.json: file: is required/);
  });

  it("fails on a malformed host file", () => {
    const raw = base();
    raw.hosts = [host("salma", 1, { topics: [] }), host("omar", 2)];
    expect(check(raw)).toThrow(/hosts\/salma\.json: topics/);
  });

  it("reports every problem, not just the first", () => {
    const raw = base();
    raw.videos = [video("one", { stage: "x" }), video("two", { host: "nobody" })];
    raw.transcripts = [];
    const message = (() => {
      try {
        check(raw)();
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();
    expect(message.split("\n")).toHaveLength(3);
  });

  it("requires a folder for an available language only", () => {
    expect(check(null, true)).toThrow(/content\/arabic-egyptian: folder/);
    expect(check(null, false)()).toEqual({ videos: [], hosts: [], transcripts: {}, glossary: { entries: [] } });
  });

  it("requires at least one host and one video for an available language", () => {
    const raw = base();
    raw.videos = [];
    raw.hosts = [];
    expect(check(raw)).toThrow(/at least one host[\s\S]*at least one video/);
  });
});
