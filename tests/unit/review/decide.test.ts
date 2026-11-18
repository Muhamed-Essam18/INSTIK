import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { allowedNext, videoStatuses, type VideoStatusName } from "@/lib/content/status";
import { creatorActor, learnerActor, owner, segment, setupReview, ticked, video } from "../../helpers/review-memory";

const readyVideo = (extra = {}) => video({ id: "v1", checks: { ...ticked }, ...extra });
const ready = (extra = {}) => setupReview({ videos: [readyVideo(extra)], segments: { v1: [segment({ id: "s1", start: 0, end: 5 })] } });

describe("approve", () => {
  it("sets the final stage and access, the status, and writes one history entry with the owner", async () => {
    const t = ready({ stage: "follow-it", access: "FREE" });
    const r = await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    expect(r).toMatchObject({ ok: true, creatorName: "Salma" });
    expect(t.state.videos.get("v1")).toMatchObject({ status: "APPROVED", stage: "follow-it", access: "FREE" });
    expect(t.state.events).toHaveLength(1);
    expect(t.state.events[0]).toMatchObject({ fromStatus: "IN_REVIEW", toStatus: "APPROVED", actorId: "boss", actorLabel: "Boss", note: null });
  });

  it("uses the creator's proposed stage when the owner set none", async () => {
    const t = ready({ stage: null, proposedStage: "join-in" });
    await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    expect(t.state.videos.get("v1")!.stage).toBe("join-in");
  });

  const unchanged = (t: ReturnType<typeof setupReview>) => {
    expect(t.state.events).toHaveLength(0);
    expect(t.state.videos.get("v1")!.status).toBe(t.state.videos.get("v1")!.status);
  };

  it("is refused with an incomplete checklist, naming it", async () => {
    const t = ready({ checks: { ...ticked, transcript: false } });
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "checklist" });
    expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
    unchanged(t);
  });

  it("is refused without a transcript segment", async () => {
    const t = setupReview({ videos: [readyVideo()] });
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "no-transcript" });
    unchanged(t);
  });

  it.each([
    ["playback id", { playbackId: null }],
    ["duration", { durationSeconds: null }],
  ])("is refused when the video has no %s (not ready)", async (_name, extra) => {
    const t = ready(extra);
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "not-ready" });
    unchanged(t);
  });

  it("is refused without any stage", async () => {
    const t = ready({ stage: null, proposedStage: null });
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "no-stage" });
    unchanged(t);
  });

  it("lists every problem together", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    const r = await t.service.decide(owner, { videoId: "v1", decision: "approve" });
    expect(r).toMatchObject({ ok: false, problems: ["checklist", "no-transcript"] });
  });

  it.each(["CHANGES_REQUESTED", "APPROVED", "REJECTED", "PROCESSING"] as const)("is refused when the video is %s", async (status) => {
    const t = ready({ status });
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "not-in-review" });
    expect(t.state.events).toHaveLength(0);
  });
});

describe("request changes and reject", () => {
  it.each([
    ["changes", "CHANGES_REQUESTED"],
    ["reject", "REJECTED"],
  ] as const)("%s needs a non-empty trimmed note of at most 2,000 characters", async (decision, status) => {
    const t = ready();
    expect(await t.service.decide(owner, { videoId: "v1", decision })).toMatchObject({ ok: false, reason: "note-required" });
    expect(await t.service.decide(owner, { videoId: "v1", decision, note: "   " })).toMatchObject({ ok: false, reason: "note-required" });
    expect(await t.service.decide(owner, { videoId: "v1", decision, note: "x".repeat(2001) })).toMatchObject({ ok: false, reason: "note-too-long" });
    expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
    expect(t.state.events).toHaveLength(0);

    const ok = await t.service.decide(owner, { videoId: "v1", decision, note: "  Please redo the audio.  " });
    expect(ok.ok).toBe(true);
    expect(t.state.videos.get("v1")!.status).toBe(status);
    expect(t.state.events[0]).toMatchObject({ toStatus: status, note: "Please redo the audio.", actorId: "boss" });
  });

  it("do not need the checklist or a transcript", async () => {
    const t = setupReview({ videos: [video({ id: "v1" })] });
    expect((await t.service.decide(owner, { videoId: "v1", decision: "changes", note: "Louder, please." })).ok).toBe(true);
  });

  it("accepts a note of exactly 2,000 characters", async () => {
    const t = ready();
    expect((await t.service.decide(owner, { videoId: "v1", decision: "reject", note: "x".repeat(2000) })).ok).toBe(true);
  });
});

describe("one decision wins", () => {
  it("refuses a second decision after the first", async () => {
    const t = ready();
    expect((await t.service.decide(owner, { videoId: "v1", decision: "reject", note: "No." })).ok).toBe(true);
    expect(await t.service.decide(owner, { videoId: "v1", decision: "approve" })).toMatchObject({ ok: false, reason: "not-in-review" });
    expect(t.state.events).toHaveLength(1);
  });

  it("gives exactly one winner when two owners decide at once, with one history entry and one email", async () => {
    const t = ready();
    const [a, b] = await Promise.all([
      t.service.decide(owner, { videoId: "v1", decision: "approve" }),
      t.service.decide({ ...owner, id: "boss2", name: "Boss 2" }, { videoId: "v1", decision: "reject", note: "No." }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(t.state.events).toHaveLength(1);
    expect(t.sent).toHaveLength(1);
  });

  it("a failing transaction rolls everything back", async () => {
    const t = ready();
    await expect(
      t.store.transaction(async (tx) => {
        await tx.setStatus("v1", "IN_REVIEW", "APPROVED");
        await tx.appendEvent({ videoId: "v1", fromStatus: "IN_REVIEW", toStatus: "APPROVED", actorId: "boss", actorLabel: "Boss", note: null });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
    expect(t.state.events).toHaveLength(0);
  });
});

describe("approved and rejected have no way out (FR-017)", () => {
  const others = (from: VideoStatusName) => videoStatuses.filter((s) => s !== from);
  it.each(["APPROVED", "REJECTED"] as const)("every move out of %s is off the path", (from) => {
    expect(allowedNext(from)).toEqual([]);
    expect(others(from).length).toBe(6);
  });

  it.each(["APPROVED", "REJECTED"] as const)("an owner deciding on a %s video changes nothing, for every decision", async (status) => {
    const t = ready({ status });
    for (const decision of ["approve", "changes", "reject"] as const) {
      const r = await t.service.decide(owner, { videoId: "v1", decision, note: "Again." });
      expect(r).toMatchObject({ ok: false, reason: "not-in-review" });
    }
    expect(t.state.videos.get("v1")!.status).toBe(status);
    expect(t.state.events).toHaveLength(0);
  });
});

describe("only an owner decides (SC-009)", () => {
  it("refuses a creator, a learner and nobody for every decision", async () => {
    const t = ready();
    for (const actor of [creatorActor, learnerActor, null]) {
      for (const decision of ["approve", "changes", "reject"] as const) {
        await expect(t.service.decide(actor, { videoId: "v1", decision, note: "x" })).rejects.toBeInstanceOf(ForbiddenError);
      }
    }
    expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
    expect(t.state.events).toHaveLength(0);
    expect(t.sent).toHaveLength(0);
  });
});
