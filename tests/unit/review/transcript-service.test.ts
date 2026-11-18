import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { creatorActor, learnerActor, owner, segment, setupReview, video } from "../../helpers/review-memory";

const body = { videoId: "v1", start: 1, end: 4, script: "الدُّنْيا", transliteration: "id-donya", english: "The world" };
const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nأهلا\n\n00:00:05.000 --> 00:00:07.000\nمرحبا\n";

const fresh = () => setupReview({ videos: [video({ id: "v1" })] });
const positions = (t: ReturnType<typeof setupReview>) =>
  (t.state.segments.get("v1") ?? []).sort((a, b) => a.position - b.position).map((s) => `${s.position}:${s.start}`);

describe("saveSegment", () => {
  it("creates a segment at revision 0 and numbers it by start time", async () => {
    const t = fresh();
    const a = await t.service.saveSegment(owner, { ...body, start: 10, end: 12 });
    const b = await t.service.saveSegment(owner, body);
    expect(a.ok && a.segment.revision).toBe(0);
    expect(b.ok && b.segment.position).toBe(1);
    expect(positions(t)).toEqual(["1:1", "2:10"]);
  });

  it("updates, bumps the revision and reorders when the start moves", async () => {
    const t = fresh();
    const a = await t.service.saveSegment(owner, body);
    await t.service.saveSegment(owner, { ...body, start: 10, end: 12 });
    if (!a.ok) throw new Error("setup");
    const moved = await t.service.saveSegment(owner, { ...body, segmentId: a.segment.id, revision: 0, start: 20, end: 22 });
    expect(moved.ok && moved.segment.revision).toBe(1);
    expect(positions(t)).toEqual(["1:10", "2:20"]);
  });

  it("returns conflict for a stale revision and changes nothing", async () => {
    const t = fresh();
    const a = await t.service.saveSegment(owner, body);
    if (!a.ok) throw new Error("setup");
    await t.service.saveSegment(owner, { ...body, segmentId: a.segment.id, revision: 0, english: "mine" });
    const stale = await t.service.saveSegment(owner, { ...body, segmentId: a.segment.id, revision: 0, english: "theirs" });
    expect(stale).toMatchObject({ ok: false, reason: "conflict" });
    expect(t.state.segments.get("v1")![0]).toMatchObject({ english: "mine", revision: 1 });
  });

  it("returns conflict when the segment was deleted meanwhile", async () => {
    const t = fresh();
    const a = await t.service.saveSegment(owner, body);
    if (!a.ok) throw new Error("setup");
    await t.service.deleteSegment(owner, { videoId: "v1", segmentId: a.segment.id, revision: 0 });
    expect(await t.service.saveSegment(owner, { ...body, segmentId: a.segment.id, revision: 0 })).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("refuses overlap, bad times and a missing script, writing nothing", async () => {
    const t = fresh();
    await t.service.saveSegment(owner, body);
    expect(await t.service.saveSegment(owner, { ...body, start: 3, end: 6 })).toMatchObject({ ok: false, reason: "overlap" });
    expect(await t.service.saveSegment(owner, { ...body, start: 9, end: 8 })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await t.service.saveSegment(owner, { ...body, start: 9, end: 900 })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await t.service.saveSegment(owner, { ...body, start: 9, end: 10, script: " " })).toMatchObject({ ok: false, reason: "invalid" });
    expect(t.state.segments.get("v1")).toHaveLength(1);
  });

  it("marks glossary words in the saved segment", async () => {
    const t = setupReview(
      { videos: [video({ id: "v1" })], glossary: [{ id: "g1", entryKey: "donya", word: "دنيا", base: "دنيا", transliteration: "donya", english: "world" }] },
    );
    const r = await t.service.saveSegment(owner, { ...body, script: "الدُّنْيا دنيا" });
    expect(r.ok && r.segment.links.some((l) => l.entryId === "donya")).toBe(true);
    expect(r.ok && Object.keys(r.entries)).toEqual(["donya"]);
  });
});

describe("deleteSegment", () => {
  it("deletes, renumbers and refuses a stale revision", async () => {
    const t = setupReview({
      videos: [video({ id: "v1" })],
      segments: { v1: [segment({ id: "a", start: 0, end: 2, position: 1 }), segment({ id: "b", start: 3, end: 5, position: 2 }), segment({ id: "c", start: 6, end: 8, position: 3, revision: 2 })] },
    });
    expect(await t.service.deleteSegment(owner, { videoId: "v1", segmentId: "a", revision: 0 })).toEqual({ ok: true });
    expect(positions(t)).toEqual(["1:3", "2:6"]);
    expect(await t.service.deleteSegment(owner, { videoId: "v1", segmentId: "c", revision: 0 })).toMatchObject({ ok: false, reason: "conflict" });
    expect(t.state.segments.get("v1")).toHaveLength(2);
  });
});

describe("VTT import", () => {
  it("previews without writing", async () => {
    const t = fresh();
    expect(await t.service.previewVtt(owner, { videoId: "v1", text: vtt })).toEqual({ ok: true, count: 2, first: 1, last: 7, problems: [] });
    expect(t.state.segments.get("v1") ?? []).toHaveLength(0);
  });

  it("names the line of a malformed file and writes nothing", async () => {
    const t = fresh();
    const bad = "WEBVTT\n\n00:00:05.000 --> 00:00:01.000\nx\n";
    const preview = await t.service.previewVtt(owner, { videoId: "v1", text: bad });
    expect(preview.ok === false && preview.problems[0]).toMatch(/^line 3:/);
    expect(await t.service.importVtt(owner, { videoId: "v1", text: bad, mode: "replace" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(t.state.segments.get("v1") ?? []).toHaveLength(0);
  });

  it("refuses a file over 1 MB", async () => {
    const t = fresh();
    const huge = `WEBVTT\n\n${"x".repeat(1024 * 1024 + 1)}`;
    expect(await t.service.previewVtt(owner, { videoId: "v1", text: huge })).toMatchObject({ ok: false });
  });

  it("Replace swaps the whole transcript", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], segments: { v1: [segment({ id: "old", start: 0, end: 50 })] } });
    expect(await t.service.importVtt(owner, { videoId: "v1", text: vtt, mode: "replace" })).toEqual({ ok: true, count: 2 });
    expect(positions(t)).toEqual(["1:1", "2:5"]);
    expect(t.state.segments.get("v1")!.every((s) => s.id !== "old")).toBe(true);
  });

  it("Add keeps the existing segments and slots the new ones in", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], segments: { v1: [segment({ id: "mid", start: 3.5, end: 4.5, position: 1 })] } });
    expect(await t.service.importVtt(owner, { videoId: "v1", text: vtt, mode: "add" })).toEqual({ ok: true, count: 2 });
    expect(positions(t)).toEqual(["1:1", "2:3.5", "3:5"]);
  });

  it("Add is all or nothing when something overlaps", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })], segments: { v1: [segment({ id: "mid", start: 2, end: 6, position: 1 })] } });
    const result = await t.service.importVtt(owner, { videoId: "v1", text: vtt, mode: "add" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(t.state.segments.get("v1")).toHaveLength(1);
  });
});

describe("checklist and classification", () => {
  it("saves a tick and keeps the others", async () => {
    const t = fresh();
    await t.service.setChecklist(owner, { videoId: "v1", key: "audio", checked: true });
    await t.service.setChecklist(owner, { videoId: "v1", key: "safe", checked: true });
    await t.service.setChecklist(owner, { videoId: "v1", key: "audio", checked: false });
    expect(t.state.videos.get("v1")!.checks).toMatchObject({ audio: false, safe: true });
  });

  it("saves stage and access, accepting only a taxonomy stage and FREE or FULL", async () => {
    const t = fresh();
    expect(await t.service.setClassification(owner, { videoId: "v1", stage: "follow-it", access: "FREE" })).toEqual({ ok: true });
    expect(t.state.videos.get("v1")).toMatchObject({ stage: "follow-it", access: "FREE" });
    expect(await t.service.setClassification(owner, { videoId: "v1", stage: "nonsense", access: "FREE" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await t.service.setClassification(owner, { videoId: "v1", stage: "join-in", access: "PAID" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(t.state.videos.get("v1")).toMatchObject({ stage: "follow-it", access: "FREE" });
  });
});

describe("nothing saves unless the video is In review", () => {
  it.each(["CHANGES_REQUESTED", "APPROVED", "REJECTED", "PROCESSING"] as const)("refuses every write for %s", async (status) => {
    const t = setupReview({ videos: [video({ id: "v1", status })], segments: { v1: [segment({ id: "a", start: 0, end: 2 })] } });
    const refused = { ok: false, reason: "not-in-review" };
    expect(await t.service.setChecklist(owner, { videoId: "v1", key: "audio", checked: true })).toEqual(refused);
    expect(await t.service.setClassification(owner, { videoId: "v1", stage: "hear-it", access: "FULL" })).toEqual(refused);
    expect(await t.service.saveSegment(owner, body)).toEqual(refused);
    expect(await t.service.saveSegment(owner, { ...body, segmentId: "a", revision: 0 })).toEqual(refused);
    expect(await t.service.deleteSegment(owner, { videoId: "v1", segmentId: "a", revision: 0 })).toEqual(refused);
    expect(await t.service.importVtt(owner, { videoId: "v1", text: vtt, mode: "replace" })).toEqual(refused);
    expect(await t.service.addGlossaryEntry(owner, { videoId: "v1", word: "كلمة", transliteration: "kilma", english: "word" })).toEqual(refused);
    expect(await t.service.updateGlossaryEntry(owner, { videoId: "v1", entryId: "g", transliteration: "a", english: "b" })).toEqual(refused);
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "not-in-review" });
    expect(t.state.segments.get("v1")).toHaveLength(1);
    expect(t.state.videos.get("v1")!.checks.audio).toBe(false);
  });

  it("treats a missing or deleted video as not found", async () => {
    const t = setupReview({ videos: [video({ id: "v1", deleted: true })] });
    expect(await t.service.saveSegment(owner, body)).toEqual({ ok: false, reason: "not-found" });
    expect(await t.service.saveSegment(owner, { ...body, videoId: "nope" })).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("getReview", () => {
  it("is read-only for Changes requested and missing for any other status or a deleted video", async () => {
    const t = setupReview({
      videos: [video({ id: "r" }), video({ id: "c", status: "CHANGES_REQUESTED" }), video({ id: "a", status: "APPROVED" }), video({ id: "x", deleted: true })],
    });
    expect((await t.service.getReview(owner, "r"))!.readOnly).toBe(false);
    expect((await t.service.getReview(owner, "c"))!.readOnly).toBe(true);
    expect(await t.service.getReview(owner, "a")).toBeNull();
    expect(await t.service.getReview(owner, "x")).toBeNull();
    expect(await t.service.getReview(owner, "none")).toBeNull();
  });

  it("never carries the creator's email", async () => {
    const t = fresh();
    expect(JSON.stringify(await t.service.getReview(owner, "v1"))).not.toContain("salma@x.com");
  });
});

describe("a creator and a learner are refused on every function", () => {
  it("throws ForbiddenError for each", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    for (const actor of [creatorActor, learnerActor, null]) {
      const calls = [
        t.service.getReview(actor, "v1"),
        t.service.setChecklist(actor, { videoId: "v1", key: "audio", checked: true }),
        t.service.setClassification(actor, { videoId: "v1", stage: "hear-it", access: "FULL" }),
        t.service.saveSegment(actor, body),
        t.service.deleteSegment(actor, { videoId: "v1", segmentId: "a", revision: 0 }),
        t.service.previewVtt(actor, { videoId: "v1", text: vtt }),
        t.service.importVtt(actor, { videoId: "v1", text: vtt, mode: "add" }),
        t.service.addGlossaryEntry(actor, { videoId: "v1", word: "كلمة", transliteration: "k", english: "w" }),
        t.service.updateGlossaryEntry(actor, { videoId: "v1", entryId: "g", transliteration: "k", english: "w" }),
        t.service.decide(actor, { videoId: "v1", decision: "approve" }),
      ];
      for (const call of calls) await expect(call).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(t.state.segments.get("v1") ?? []).toHaveLength(0);
    expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
  });
});
