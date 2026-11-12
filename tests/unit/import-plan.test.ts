import { describe, expect, it } from "vitest";
import { emptyExisting, planImport, type ExistingState, type PlanItem } from "@/lib/content/import/plan";
import type { RawContent } from "@/lib/content/validate";

const language = {
  slug: "arabic-egyptian",
  available: true,
  transcriptLayers: ["script", "tashkeel", "transliteration", "english"] as const,
};

const host = (slug: string, order: number, extra: object = {}) => ({
  file: `hosts/${slug}.json`,
  data: { slug, name: slug, nameArabic: "س", story: "A story", topics: ["Food"], order, ...extra },
});
const video = (slug: string, extra: object = {}) => ({
  file: `videos/${slug}.json`,
  data: {
    title: slug,
    slug,
    stage: "hear-it",
    topic: "food",
    host: "salma",
    durationSeconds: 300,
    access: "free",
    ...extra,
  },
});
const goodVtt = "WEBVTT\n\n00:00:02.000 --> 00:00:04.000\nصَباح الخَيْر!\nṣabāḥ el-khēr!\nGood morning!\n";
const entry = (id: string, word: string, extra: object = {}) => ({ id, word, base: word, transliteration: id, english: id, ...extra });

function raw(over: Partial<RawContent> = {}): RawContent {
  return {
    hosts: [host("salma", 1), host("omar", 2)],
    videos: [video("my-family"), video("at-the-cafe", { host: "omar" })],
    transcripts: [{ file: "videos/my-family.vtt", text: goodVtt }],
    glossary: { file: "glossary.json", data: { entries: [entry("ana", "أَنَا"), entry("di", "دِي")] } },
    ...over,
  };
}

const kinds = (plan: PlanItem[]) => plan.map((p) => p.kind);
const failures = (plan: PlanItem[]) => plan.filter((p): p is Extract<PlanItem, { kind: "fail" }> => p.kind === "fail");

describe("planImport on an empty database", () => {
  it("creates every host, video and glossary entry", () => {
    const plan = planImport({ language, raw: raw(), existing: emptyExisting() });
    expect(plan.filter((p) => p.kind === "create-host")).toHaveLength(2);
    expect(plan.filter((p) => p.kind === "create-video")).toHaveLength(2);
    expect(plan.filter((p) => p.kind === "create-glossary")).toHaveLength(2);
    expect(failures(plan)).toEqual([]);
  });

  it("creates a video without a transcript as approved with no segments", () => {
    const plan = planImport({ language, raw: raw(), existing: emptyExisting() });
    const cafe = plan.find((p) => p.kind === "create-video" && p.video.slug === "at-the-cafe");
    expect(cafe).toMatchObject({ kind: "create-video", segments: [] });
    const family = plan.find((p) => p.kind === "create-video" && p.video.slug === "my-family");
    expect(family).toMatchObject({ kind: "create-video" });
    expect((family as Extract<PlanItem, { kind: "create-video" }>).segments).toHaveLength(1);
  });
});

describe("planImport when everything is already stored", () => {
  const existing: ExistingState = {
    hostSlugs: new Set(["salma", "omar"]),
    glossaryKeys: new Set(["ana", "di"]),
    videos: new Map([
      ["my-family", { incompleteDraft: false }],
      ["at-the-cafe", { incompleteDraft: false }],
    ]),
  };

  it("only skips and never creates or fails", () => {
    const plan = planImport({ language, raw: raw(), existing });
    expect(new Set(kinds(plan))).toEqual(new Set(["skip-present"]));
    expect(plan).toHaveLength(6);
  });
});

describe("planImport with a damaged transcript", () => {
  const damaged = raw({ transcripts: [{ file: "videos/my-family.vtt", text: "no header here" }] });

  it("saves the video as a draft with the reason and still imports the rest", () => {
    const plan = planImport({ language, raw: damaged, existing: emptyExisting() });
    const draft = plan.find((p) => p.kind === "create-video-draft");
    expect(draft).toMatchObject({ video: { slug: "my-family" } });
    expect((draft as { reason: string }).reason).toMatch(/WEBVTT/);
    expect(plan.filter((p) => p.kind === "create-video")).toHaveLength(1);
  });

  it("treats a transcript with no cues as invalid", () => {
    const plan = planImport({
      language,
      raw: raw({ transcripts: [{ file: "videos/my-family.vtt", text: "WEBVTT\n" }] }),
      existing: emptyExisting(),
    });
    expect(plan.find((p) => p.kind === "create-video-draft")).toBeDefined();
  });

  it("completes the draft when the transcript is valid again", () => {
    const existing: ExistingState = {
      hostSlugs: new Set(["salma", "omar"]),
      glossaryKeys: new Set(["ana", "di"]),
      videos: new Map([
        ["my-family", { incompleteDraft: true }],
        ["at-the-cafe", { incompleteDraft: false }],
      ]),
    };
    const plan = planImport({ language, raw: raw(), existing });
    expect(plan.find((p) => p.kind === "complete-draft")).toMatchObject({ slug: "my-family" });
    expect(plan.filter((p) => p.kind === "create-video" || p.kind === "create-video-draft")).toEqual([]);
  });

  it("leaves the draft alone while the transcript is still invalid", () => {
    const existing: ExistingState = {
      hostSlugs: new Set(["salma", "omar"]),
      glossaryKeys: new Set(),
      videos: new Map([["my-family", { incompleteDraft: true }]]),
    };
    const plan = planImport({ language, raw: damaged, existing });
    expect(plan.find((p) => p.kind === "complete-draft")).toBeUndefined();
    expect(plan.find((p) => p.kind === "still-incomplete" && p.item === "videos/my-family.json")).toBeDefined();
  });

  it("never touches an existing video that is not an import draft", () => {
    const existing: ExistingState = {
      hostSlugs: new Set(["salma", "omar"]),
      glossaryKeys: new Set(),
      videos: new Map([["my-family", { incompleteDraft: false }]]),
    };
    const plan = planImport({ language, raw: raw(), existing });
    expect(plan.find((p) => p.kind === "complete-draft")).toBeUndefined();
  });
});

describe("planImport failures", () => {
  it("fails an unknown host, an unknown topic, a bad slug and a duplicate slug, and still plans the others", () => {
    const plan = planImport({
      language,
      raw: raw({
        videos: [
          video("good-one"),
          video("no-host", { host: "ghost" }),
          video("bad-topic", { topic: "cooking" }),
          video("BadSlug", { slug: "BadSlug" }),
          video("good-one-copy", { slug: "good-one" }),
        ],
        transcripts: [],
      }),
      existing: emptyExisting(),
    });
    expect(plan.filter((p) => p.kind === "create-video").map((p) => (p as { video: { slug: string } }).video.slug)).toEqual([
      "good-one",
    ]);
    const reasons = Object.fromEntries(failures(plan).map((f) => [f.item, f.reason]));
    expect(reasons["videos/no-host.json"]).toMatch(/unknown host "ghost"/);
    expect(reasons["videos/bad-topic.json"]).toMatch(/topic/);
    expect(reasons["videos/BadSlug.json"]).toMatch(/slug/);
    expect(reasons["videos/good-one-copy.json"]).toMatch(/slug/);
  });

  it("makes a failed host fail its videos with that reason", () => {
    const plan = planImport({
      language,
      raw: raw({ hosts: [host("salma", 1, { name: "" }), host("omar", 2)] }),
      existing: emptyExisting(),
    });
    expect(failures(plan).find((f) => f.item === "hosts/salma.json")).toBeDefined();
    const family = failures(plan).find((f) => f.item === "videos/my-family.json");
    expect(family?.reason).toMatch(/host "salma" could not be imported/);
    expect(plan.filter((p) => p.kind === "create-video")).toHaveLength(1);
  });

  it("fails ambiguous glossary entries but imports the rest", () => {
    const plan = planImport({
      language,
      raw: raw({
        glossary: { file: "glossary.json", data: { entries: [entry("ana", "أَنَا"), entry("ana2", "أنا"), entry("di", "دِي")] } },
      }),
      existing: emptyExisting(),
    });
    expect(plan.filter((p) => p.kind === "create-glossary")).toHaveLength(2);
    expect(failures(plan).map((f) => f.item)).toEqual(["glossary.json#ana2"]);
  });

  it("fails a duplicate glossary id", () => {
    const plan = planImport({
      language,
      raw: raw({ glossary: { file: "glossary.json", data: { entries: [entry("ana", "أَنَا"), entry("ana", "دِي")] } } }),
      existing: emptyExisting(),
    });
    expect(failures(plan)[0]).toMatchObject({ item: "glossary.json#ana", reason: expect.stringMatching(/duplicate id/) });
  });

  it("fails a transcript that has no video", () => {
    const plan = planImport({
      language,
      raw: raw({ transcripts: [{ file: "videos/ghost.vtt", text: goodVtt }] }),
      existing: emptyExisting(),
    });
    expect(failures(plan).map((f) => f.item)).toContain("videos/ghost.vtt");
  });

  it("fails a missing folder only for an available language", () => {
    expect(planImport({ language, raw: null, existing: emptyExisting() })).toHaveLength(1);
    expect(planImport({ language: { ...language, available: false }, raw: null, existing: emptyExisting() })).toEqual([]);
  });

  it("fails a slug that does not match its file name", () => {
    const plan = planImport({
      language,
      raw: raw({ videos: [{ file: "videos/one.json", data: video("two").data }], transcripts: [] }),
      existing: emptyExisting(),
    });
    expect(failures(plan)[0].reason).toMatch(/must match the file name "one"/);
  });
});
