import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getGlossary, getHosts, getTranscript, getTranscriptView, getVideo, getVideos } from "@/lib/content";
import { stageLabel } from "@/lib/content/taxonomy";

// The content module reads the database; here it reads the stand-in filled from the sample files (all Approved, as after the import).
vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../helpers/content-db");
  return { db: () => contentDb.db };
});

const language = "arabic-egyptian";
const dir = path.join(process.cwd(), "content", language);

describe("shipped Egyptian Arabic sample content", () => {
  it("builds and has the planned shape", async () => {
    const videos = await getVideos(language);
    expect(videos).toHaveLength(8);
    const count = (label: string) => videos.filter((v) => stageLabel(v.stage) === label).length;
    expect([count("Hear it"), count("Follow it"), count("Understand it")]).toEqual([2, 4, 2]);
    expect((await getHosts(language)).map((h) => h.slug)).toEqual(["salma", "omar"]);
    expect((await getGlossary(language)).entries.length).toBeGreaterThan(0);
  });

  it("has exactly two transcripts and at least one video without one", async () => {
    const all = await getVideos(language);
    const flags = await Promise.all(all.map(async (v) => [v.slug, (await getTranscript(language, v.slug)) !== undefined] as const));
    const withTranscript = flags.filter(([, has]) => has).map(([slug]) => slug);
    expect(withTranscript.sort()).toEqual(["at-the-cafe", "my-family"]);
    expect(all.length).toBeGreaterThan(withTranscript.length);
  });

  it("marks every file as sample", () => {
    for (const sub of ["videos", "hosts"]) {
      for (const name of readdirSync(path.join(dir, sub)).filter((n) => n.endsWith(".json"))) {
        const data = JSON.parse(readFileSync(path.join(dir, sub, name), "utf8"));
        expect(data.sample, `${sub}/${name}`).toBe(true);
      }
    }
    expect(JSON.parse(readFileSync(path.join(dir, "glossary.json"), "utf8")).sample).toBe(true);
    for (const name of readdirSync(path.join(dir, "videos")).filter((n) => n.endsWith(".vtt"))) {
      expect(readFileSync(path.join(dir, "videos", name), "utf8"), name).toMatch(/^WEBVTT\r?\n\r?\nNOTE sample/);
    }
  });

  it("has the video the pick-up banner points to", async () => {
    expect(await getVideo(language, "at-the-cafe")).toBeDefined();
  });

  it("returns undefined for unknown videos", async () => {
    expect(await getVideo(language, "nope")).toBeUndefined();
  });
});

describe("shipped transcripts, three-layer format", () => {
  it("every line has script, transliteration and English, and all times fit the 30 s sample clip", async () => {
    for (const slug of ["my-family", "at-the-cafe"]) {
      const lines = (await getTranscript(language, slug))!;
      expect(lines.length).toBeGreaterThanOrEqual(3);
      for (const line of lines) {
        expect(line.script).toBeTruthy();
        expect(line.transliteration).toBeTruthy();
        expect(line.english).toBeTruthy();
        expect(line.end).toBeLessThanOrEqual(30);
      }
    }
  });

  it("links the glossary words in the transcripts, leaves the rest plain, and glossary keys are unique", async () => {
    const view = (await getTranscriptView(language, "at-the-cafe"))!;
    const linked = view.lines.flatMap((l) => l.segments.filter((s) => s.entryId).map((s) => s.entryId));
    expect(linked).toEqual(
      expect.arrayContaining(["sabah", "kheir", "ayza", "ahwa-a", "men-fadlak", "bi-sukkar", "walla", "men-gheir", "sukkar", "shukran"]),
    );
    expect(view.lines[0].segments.map((s) => s.text).join("")).toBe((await getTranscript(language, "at-the-cafe"))![0].script);
    for (const id of linked) expect(view.entries[id!]).toBeDefined();
  });
});
