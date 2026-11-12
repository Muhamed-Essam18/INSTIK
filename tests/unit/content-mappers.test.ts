import { describe, expect, it } from "vitest";
import { toGlossaryEntry, toHost, toTranscriptLines, toVideo } from "@/lib/content/mappers";

const videoRow = {
  slug: "at-the-cafe",
  title: "At the café",
  titleArabic: "في الكَافِيه",
  stage: "follow-it",
  topic: "food",
  durationSeconds: 520,
  access: "FREE" as const,
  playbackId: "pb-1",
  sample: true,
  host: { slug: "salma" },
};

describe("toVideo", () => {
  it("maps a row to the shape the learner site uses", () => {
    expect(toVideo(videoRow)).toEqual({
      sample: true,
      title: "At the café",
      titleArabic: "في الكَافِيه",
      slug: "at-the-cafe",
      stage: "follow-it",
      topic: "food",
      host: "salma",
      durationSeconds: 520,
      access: "free",
      playbackId: "pb-1",
    });
  });

  it("maps FULL to full and leaves out empty optional fields", () => {
    const video = toVideo({ ...videoRow, access: "FULL", titleArabic: null, playbackId: null, sample: false });
    expect(video.access).toBe("full");
    expect(video).not.toHaveProperty("titleArabic");
    expect(video).not.toHaveProperty("playbackId");
    expect(video).not.toHaveProperty("sample");
  });
});

describe("toHost", () => {
  it("keeps a new creator's empty fields as they are", () => {
    expect(
      toHost({ slug: "new-creator", name: "New Creator", nameArabic: null, story: "", topics: [], photo: null, order: 3 }),
    ).toEqual({ slug: "new-creator", name: "New Creator", nameArabic: null, story: "", topics: [], photo: null, order: 3 });
  });
});

describe("toTranscriptLines", () => {
  it("returns lines in position order", () => {
    const lines = toTranscriptLines([
      { position: 1, start: 4, end: 6, script: "ب", transliteration: null, english: "two" },
      { position: 0, start: 1, end: 3, script: "أ", transliteration: "a", english: null },
    ]);
    expect(lines.map((l) => l.script)).toEqual(["أ", "ب"]);
    expect(lines[0]).toEqual({ start: 1, end: 3, script: "أ", transliteration: "a", english: null });
  });
});

describe("toGlossaryEntry", () => {
  it("uses the entry key as the id and drops a missing audio", () => {
    const entry = toGlossaryEntry({ entryKey: "ana", word: "أَنَا", base: "أنا", transliteration: "ana", english: "I", audio: null });
    expect(entry).toEqual({ id: "ana", word: "أَنَا", base: "أنا", transliteration: "ana", english: "I" });
    expect(toGlossaryEntry({ entryKey: "x", word: "w", base: "b", transliteration: "t", english: "e", audio: "a.mp3" }).audio).toBe("a.mp3");
  });
});
