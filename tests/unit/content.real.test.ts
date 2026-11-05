import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getGlossary, getHosts, getTranscript, getVideo, getVideos } from "@/lib/content";
import { stageLabel } from "@/lib/content/taxonomy";

const language = "arabic-egyptian";
const dir = path.join(process.cwd(), "content", language);

describe("shipped Egyptian Arabic sample content", () => {
  it("builds and has the planned shape", () => {
    const videos = getVideos(language);
    expect(videos).toHaveLength(8);
    const count = (label: string) => videos.filter((v) => stageLabel(v.stage) === label).length;
    expect([count("Hear it"), count("Follow it"), count("Understand it")]).toEqual([2, 4, 2]);
    expect(getHosts(language).map((h) => h.slug)).toEqual(["salma", "omar"]);
    expect(getGlossary(language).entries.length).toBeGreaterThan(0);
  });

  it("has exactly two transcripts and at least one video without one", () => {
    const withTranscript = getVideos(language).filter((v) => getTranscript(language, v.slug));
    expect(withTranscript.map((v) => v.slug).sort()).toEqual(["at-the-cafe", "my-family"]);
    expect(getVideos(language).length).toBeGreaterThan(withTranscript.length);
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

  it("has the video the pick-up banner points to", () => {
    expect(getVideo(language, "at-the-cafe")).toBeDefined();
  });

  it("returns undefined for unknown videos", () => {
    expect(getVideo(language, "nope")).toBeUndefined();
  });
});
