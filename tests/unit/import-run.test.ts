import { describe, expect, it } from "vitest";
import { NOTE_COMPLETED, NOTE_IMPORTED, formatReport, runImport, type ImportEvent, type ImportStore } from "@/lib/content/import/run";
import type { ExistingState } from "@/lib/content/import/plan";
import type { Host, Video } from "@/lib/content/schema";
import type { TranscriptLine } from "@/lib/content/transcript";
import type { RawContent } from "@/lib/content/validate";

const language = {
  code: "arz",
  slug: "arabic-egyptian",
  available: true,
  transcriptLayers: ["script", "tashkeel", "transliteration", "english"] as const,
};

const vtt = "WEBVTT\n\n00:00:02.000 --> 00:00:04.000\nصَباح الخَيْر!\nṣabāḥ el-khēr!\nGood morning!\n";
const slugs = [
  "my-family", "at-the-cafe", "buying-bread-at-the-bakery", "colours-at-the-market",
  "a-day-at-a-wedding", "a-walk-on-the-corniche", "ramadan-nights", "taking-a-microbus",
];
const stages = ["hear-it", "follow-it", "understand-it"] as const;

function sampleRaw(overrides: { vtt?: string } = {}): RawContent {
  return {
    hosts: [
      { file: "hosts/salma.json", data: { sample: true, slug: "salma", name: "Salma", nameArabic: "سلمى", story: "[Sample] hello", topics: ["Food"], order: 1 } },
      { file: "hosts/omar.json", data: { sample: true, slug: "omar", name: "Omar", nameArabic: "عمر", story: "[Sample] hi", topics: ["Markets"], order: 2 } },
    ],
    videos: slugs.map((slug, i) => ({
      file: `videos/${slug}.json`,
      data: {
        sample: true,
        title: `Title ${slug}`,
        titleArabic: "عنوان",
        slug,
        stage: stages[i % 3],
        topic: "food",
        host: i % 2 === 0 ? "salma" : "omar",
        durationSeconds: 300 + i,
        access: i % 2 === 0 ? "free" : "full",
        playbackId: `sample-${slug}`,
      },
    })),
    transcripts: [
      { file: "videos/my-family.vtt", text: overrides.vtt ?? vtt },
      { file: "videos/at-the-cafe.vtt", text: vtt },
    ],
    glossary: {
      file: "glossary.json",
      data: {
        sample: true,
        entries: [
          { id: "ana", word: "أَنَا", base: "أنا", transliteration: "ana", english: "I" },
          { id: "di", word: "دِي", base: "دي", transliteration: "dī", english: "this" },
        ],
      },
    },
  };
}

type StoredVideo = { video: Video; status: string; segments: TranscriptLine[]; events: ImportEvent[] };

function memoryStore(failOnVideo?: string) {
  const hosts = new Map<string, Host>();
  const glossary = new Map<string, unknown>();
  const videos = new Map<string, StoredVideo>();
  const store: ImportStore = {
    async loadExisting(): Promise<ExistingState> {
      return {
        hostSlugs: new Set(hosts.keys()),
        glossaryKeys: new Set(glossary.keys()),
        videos: new Map(
          [...videos].map(([slug, v]) => [
            slug,
            { incompleteDraft: v.status === "DRAFT" && v.events[0]?.note.startsWith("Import incomplete:") === true },
          ]),
        ),
      };
    },
    async createHost(_code, host) {
      if (hosts.has(host.slug)) throw new Error("duplicate host");
      hosts.set(host.slug, host);
    },
    async createGlossaryEntry(_code, entry) {
      if (glossary.has(entry.id)) throw new Error("duplicate entry");
      glossary.set(entry.id, entry);
    },
    async createVideo({ video, segments, status, event }) {
      if (video.slug === failOnVideo) throw new Error("connection reset");
      if (!hosts.has(video.host)) throw new Error("host missing");
      if (videos.has(video.slug)) throw new Error("duplicate video");
      videos.set(video.slug, { video, status, segments, events: [event] });
    },
    async completeDraft({ slug, segments, event }) {
      const v = videos.get(slug)!;
      v.segments = segments;
      v.status = "APPROVED";
      v.events.push(event);
    },
  };
  return { store, hosts, glossary, videos };
}

const snapshot = (m: ReturnType<typeof memoryStore>) =>
  JSON.stringify([[...m.hosts], [...m.glossary], [...m.videos]]);

const run = (m: ReturnType<typeof memoryStore>, raw: RawContent, dryRun = false) =>
  runImport({ languages: [language], readRaw: () => raw, store: m.store, dryRun });

describe("runImport", () => {
  it("imports everything on the first run", async () => {
    const m = memoryStore();
    const report = await run(m, sampleRaw());
    const l = report.languages[0];
    expect(l.hosts).toMatchObject({ imported: 2, alreadyPresent: 0, failed: [] });
    expect(l.videos).toMatchObject({ imported: 8, alreadyPresent: 0, incomplete: [], failed: [] });
    expect(l.transcripts.imported).toBe(2);
    expect(l.glossary).toMatchObject({ imported: 2, failed: [] });
    expect(report.ok).toBe(true);
    for (const v of m.videos.values()) {
      expect(v.status).toBe("APPROVED");
      expect(v.events).toEqual([{ fromStatus: null, toStatus: "APPROVED", actorLabel: "import", note: NOTE_IMPORTED }]);
    }
  });

  it("keeps every slug, title, stage, topic, access, duration and host from the files (FR-017, FR-025)", async () => {
    const m = memoryStore();
    const raw = sampleRaw();
    await run(m, raw);
    expect([...m.videos.keys()].sort()).toEqual([...slugs].sort());
    expect([...m.hosts.keys()].sort()).toEqual(["omar", "salma"]);
    for (const { file, data } of raw.videos) {
      const d = data as Video;
      const stored = m.videos.get(file.replace(/^videos\//, "").replace(/\.json$/, ""))!.video;
      expect(stored).toMatchObject({
        slug: d.slug, title: d.title, stage: d.stage, topic: d.topic, access: d.access, durationSeconds: d.durationSeconds, host: d.host,
      });
    }
  });

  it("changes nothing on the second run", async () => {
    const m = memoryStore();
    await run(m, sampleRaw());
    const before = snapshot(m);
    const second = await run(m, sampleRaw());
    expect(snapshot(m)).toBe(before);
    const l = second.languages[0];
    expect(l.hosts).toMatchObject({ imported: 0, alreadyPresent: 2 });
    expect(l.videos).toMatchObject({ imported: 0, alreadyPresent: 8 });
    expect(l.glossary).toMatchObject({ imported: 0, alreadyPresent: 2 });
    expect(l.transcripts.imported).toBe(0);
    expect(second.ok).toBe(true);
    expect(formatReport(second)).toMatch(/Done: all content is in the database\./);
  });

  it("saves a video with a damaged transcript as a draft and imports the other seven", async () => {
    const m = memoryStore();
    const report = await run(m, sampleRaw({ vtt: "garbage" }));
    const l = report.languages[0];
    expect(l.videos.imported).toBe(7);
    expect(l.videos.incomplete).toHaveLength(1);
    expect(l.videos.incomplete[0]).toMatchObject({ item: "videos/my-family.json" });
    expect(report.ok).toBe(false);
    const draft = m.videos.get("my-family")!;
    expect(draft.status).toBe("DRAFT");
    expect(draft.events[0].note).toMatch(/^Import incomplete: /);
    expect(formatReport(report)).toMatch(/Needs attention: 1 items\./);
  });

  it("keeps reporting the draft while the file is still damaged, without duplicating anything", async () => {
    const m = memoryStore();
    await run(m, sampleRaw({ vtt: "garbage" }));
    const again = await run(m, sampleRaw({ vtt: "garbage" }));
    expect(again.languages[0].videos.incomplete).toHaveLength(1);
    expect(again.ok).toBe(false);
    expect(m.videos.size).toBe(8);
  });

  it("completes the draft once the file is fixed", async () => {
    const m = memoryStore();
    await run(m, sampleRaw({ vtt: "garbage" }));
    const fixed = await run(m, sampleRaw());
    const draft = m.videos.get("my-family")!;
    expect(draft.status).toBe("APPROVED");
    expect(draft.segments).toHaveLength(1);
    expect(draft.events.map((e) => [e.fromStatus, e.toStatus, e.note])).toEqual([
      [null, "DRAFT", expect.stringMatching(/^Import incomplete/)],
      ["DRAFT", "APPROVED", NOTE_COMPLETED],
    ]);
    expect(fixed.ok).toBe(true);
    expect(m.videos.size).toBe(8);
    expect(m.hosts.size).toBe(2);
  });

  it("writes nothing on a dry run but reports what would happen", async () => {
    const m = memoryStore();
    const report = await run(m, sampleRaw(), true);
    expect(snapshot(m)).toBe(JSON.stringify([[], [], []]));
    expect(report.dryRun).toBe(true);
    expect(report.languages[0].videos.imported).toBe(8);
    expect(formatReport(report)).toMatch(/^Dry run: nothing was written\./);
  });

  it("reports a store error on one video as failed and carries on", async () => {
    const m = memoryStore("ramadan-nights");
    const report = await run(m, sampleRaw());
    const l = report.languages[0];
    expect(l.videos.imported).toBe(7);
    expect(l.videos.failed).toEqual([{ item: "videos/ramadan-nights.json", reason: "connection reset" }]);
    expect(report.ok).toBe(false);
  });

  it("skips a language that is not available and has no folder", async () => {
    const m = memoryStore();
    const report = await runImport({
      languages: [{ ...language, available: false, slug: "french", code: "fra" }],
      readRaw: () => null,
      store: m.store,
    });
    expect(report.languages).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
