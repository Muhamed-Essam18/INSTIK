import { describe, expect, it } from "vitest";
import { CHECKLIST_ITEMS } from "@/lib/creator/rules";
import { blank, creator, learner, plainOwner, setupUpload, statusOf } from "../../helpers/upload-memory";

const ticked = CHECKLIST_ITEMS.map(() => true);
const details = { title: "Visiting grandma on Friday", description: "We visit her.", proposedStage: "follow-it", topic: "family" };
const minutes = (m: number) => m * 60_000;

describe("createUpload (a first upload)", () => {
  it("makes a draft when there is none, moves it to Uploading as the creator and returns only the one-time link", async () => {
    const t = setupUpload();
    const result = await t.service.createUpload(creator("ann"), { kind: "first" });
    expect(result).toEqual({ ok: true, videoId: "new-1", uploadUrl: "https://upload.example/1" });
    expect(t.videos.get("new-1")).toMatchObject({ status: "UPLOADING", muxUploadId: "up-1", hostUserId: "ann" });
    expect(t.videos.get("new-1")!.uploadStartedAt).toEqual(t.clock.now);
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ fromStatus: "DRAFT", toStatus: "UPLOADING", actorId: "ann", actorLabel: "Ann" });
  });

  it("creates the link with the site origin as the allowed origin and the video id as passthrough", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" });
    expect(t.uploads).toEqual([{ corsOrigin: "http://localhost:3000", videoId: "v1" }]);
  });

  it("refuses a learner, an owner who is not a creator, and nobody, and makes no link", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    for (const actor of [learner, plainOwner, null]) {
      expect(await t.service.createUpload(actor, { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "not-allowed" });
    }
    expect(t.uploads).toHaveLength(0);
    expect(statusOf(t, "v1")).toBe("DRAFT");
  });

  it("makes another creator's video look missing", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    expect(await t.service.createUpload(creator("ben"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "not-found" });
    expect(t.uploads).toHaveLength(0);
  });

  it("refuses every status but Draft (and an upload that did not finish)", async () => {
    for (const status of ["PROCESSING", "IN_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"] as const) {
      const t = setupUpload([blank({ id: "v1", status })]);
      expect(await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "wrong-status" });
      expect(t.uploads).toHaveLength(0);
    }
  });

  it("creates one upload when clicked twice: the second click is refused and no second link is made", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    const results = await Promise.all([
      t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" }),
      t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(t.uploads).toHaveLength(1);
    expect(t.events).toHaveLength(1);
    // And later, while still within the link's life, another try is refused too.
    expect(await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "wrong-status" });
  });

  it("starts again once an upload did not finish: sends it back to Draft (system, plain note) first", async () => {
    const started = new Date("2026-11-13T12:00:00Z");
    const t = setupUpload([blank({ id: "v1", status: "UPLOADING", muxUploadId: "up-old", uploadStartedAt: started })]);
    t.clock.now = new Date(started.getTime() + minutes(74));
    expect(await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "wrong-status" });
    t.clock.now = new Date(started.getTime() + minutes(76));
    const result = await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" });
    expect(result.ok).toBe(true);
    expect(t.events.map((e) => `${e.fromStatus}>${e.toStatus}`)).toEqual(["UPLOADING>DRAFT", "DRAFT>UPLOADING"]);
    expect(t.events[0]).toMatchObject({ actorLabel: "Instik", note: "The upload didn't work. Please try again." });
    expect(t.videos.get("v1")).toMatchObject({ status: "UPLOADING", muxUploadId: "up-1", muxAssetId: null, submittedAt: null });
  });

  it("forgets an earlier file and submission when a new first upload starts", async () => {
    const t = setupUpload([blank({ id: "v1", muxAssetId: "as-old", assetReadyAt: new Date(), submittedAt: new Date() })]);
    await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" });
    expect(t.videos.get("v1")).toMatchObject({ muxAssetId: null, assetReadyAt: null, submittedAt: null });
  });

  it("puts the video back as it was and says so when the video host will not make a link", async () => {
    const t = setupUpload([blank({ id: "v1" })], { hostFails: true });
    expect(await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "host-error" });
    expect(statusOf(t, "v1")).toBe("DRAFT");
  });

  it("says uploads are not set up when there is no video host", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    const { createUploadService } = await import("@/lib/creator/upload-service");
    const service = createUploadService({ store: t.store, host: null, changeStatus: t.status.changeStatus, siteOrigin: () => "x" });
    expect(await service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "not-set-up" });
  });
});

describe("saveDraft", () => {
  it("makes a draft from partial details, and saves into an existing one, without changing the status", async () => {
    const t = setupUpload();
    const made = await t.service.saveDraft(creator("ann"), { details: { title: "Half done" } });
    expect(made).toEqual({ ok: true, videoId: "new-1" });
    expect(t.videos.get("new-1")).toMatchObject({ title: "Half done", status: "DRAFT" });
    await t.service.saveDraft(creator("ann"), { videoId: "new-1", details: { proposedStage: "hear-it", topic: "food" } });
    expect(t.videos.get("new-1")).toMatchObject({ title: "Half done", proposedStage: "hear-it", topic: "food" });
    expect(t.events).toHaveLength(0);
  });

  it("stores the creator's stage only as a proposal", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    await t.service.saveDraft(creator("ann"), { videoId: "v1", details: { proposedStage: "follow-it" } });
    expect(Object.keys(t.videos.get("v1")!)).not.toContain("stage");
    expect(t.videos.get("v1")!.proposedStage).toBe("follow-it");
  });

  it("refuses a learner, another creator, and a video that is in review or approved", async () => {
    const t = setupUpload([blank({ id: "v1" }), blank({ id: "v2", status: "IN_REVIEW" }), blank({ id: "v3", status: "APPROVED" })]);
    expect(await t.service.saveDraft(learner, { videoId: "v1", details: { title: "x" } })).toEqual({ ok: false, reason: "not-allowed" });
    expect(await t.service.saveDraft(creator("ben"), { videoId: "v1", details: { title: "x" } })).toEqual({ ok: false, reason: "not-found" });
    expect(await t.service.saveDraft(creator("ann"), { videoId: "v2", details: { title: "x" } })).toEqual({ ok: false, reason: "wrong-status" });
    expect(await t.service.saveDraft(creator("ann"), { videoId: "v3", details: { title: "x" } })).toEqual({ ok: false, reason: "wrong-status" });
    expect(t.videos.get("v1")!.title).toBe("");
  });
});

describe("submitVideo", () => {
  const uploading = () => blank({ id: "v1", status: "UPLOADING", muxUploadId: "up-1", uploadStartedAt: new Date("2026-11-13T11:58:00Z") });
  const submit = (t: ReturnType<typeof setupUpload>, extra: Partial<{ title: string; checklist: boolean[] }> = {}) =>
    t.service.submitVideo(creator("ann"), { videoId: "v1", details: { ...details, ...extra }, checklist: extra.checklist ?? ticked });

  it("is refused for a learner and an owner who is not a creator", async () => {
    const t = setupUpload([uploading()]);
    for (const actor of [learner, plainOwner, null]) {
      expect(await t.service.submitVideo(actor, { videoId: "v1", details, checklist: ticked })).toEqual({ ok: false, reason: "not-allowed" });
    }
    expect(t.videos.get("v1")!.submittedAt).toBeNull();
  });

  it("makes another creator's video look missing", async () => {
    const t = setupUpload([uploading()]);
    expect(await t.service.submitVideo(creator("ben"), { videoId: "v1", details, checklist: ticked })).toEqual({ ok: false, reason: "not-found" });
  });

  it("remembers a submission made while the file is still uploading or processing, and stays where it is", async () => {
    const t = setupUpload([uploading()]);
    expect(await submit(t)).toEqual({ ok: true, videoId: "v1", completed: false });
    expect(t.videos.get("v1")).toMatchObject({ status: "UPLOADING", submittedAt: t.clock.now, checklistAcceptedAt: t.clock.now });
    expect(t.events).toHaveLength(0);
  });

  it("goes straight to In review, as the creator, when the file is already ready", async () => {
    const t = setupUpload([blank({ ...uploading(), status: "PROCESSING", muxAssetId: "as-1", assetReadyAt: new Date("2026-11-13T11:59:00Z") })]);
    expect(await submit(t)).toEqual({ ok: true, videoId: "v1", completed: true });
    expect(t.videos.get("v1")).toMatchObject({ status: "IN_REVIEW", submittedAt: null });
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ fromStatus: "PROCESSING", toStatus: "IN_REVIEW", actorId: "ann", actorLabel: "Ann" });
  });

  it("assigns a slug from the title at the first submit, with a number when it is taken, and never changes it afterwards", async () => {
    const t = setupUpload([uploading(), blank({ id: "other", slug: "visiting-grandma-on-friday" })]);
    await submit(t);
    expect(t.videos.get("v1")!.slug).toBe("visiting-grandma-on-friday-2");
    await submit(t, { title: "A completely new title" });
    expect(t.videos.get("v1")!.slug).toBe("visiting-grandma-on-friday-2");
  });

  it("stores the stage only as a proposal", async () => {
    const t = setupUpload([uploading()]);
    await submit(t);
    expect(t.videos.get("v1")!.proposedStage).toBe("follow-it");
    expect(Object.keys(t.videos.get("v1")!)).not.toContain("stage");
  });

  it("names everything missing and changes nothing", async () => {
    const t = setupUpload([uploading()], { hostsComplete: { ann: false } });
    const result = await t.service.submitVideo(creator("ann"), { videoId: "v1", details: { title: "" }, checklist: [true, false, true, true, true] });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "invalid") throw new Error("expected invalid");
    expect(result.problems.map((p) => p.field)).toEqual(["title", "description", "proposedStage", "topic", "checklist", "host"]);
    expect(t.videos.get("v1")).toMatchObject({ submittedAt: null, slug: "draft-v1" });
  });

  it("asks a draft with no file to add one first", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    const result = await submit(t);
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "invalid") throw new Error("expected invalid");
    expect(result.problems.map((p) => p.field)).toEqual(["upload"]);
  });

  it("asks for a new file when the first upload did not finish (its link has expired)", async () => {
    const t = setupUpload([blank({ ...uploading(), uploadStartedAt: new Date("2026-11-13T10:00:00Z") })]);
    const result = await submit(t);
    expect(result.ok).toBe(false);
  });

  it("is idempotent: sent twice, or from two tabs, it records one submission and one history entry", async () => {
    const t = setupUpload([blank({ ...uploading(), status: "PROCESSING", muxAssetId: "as-1", assetReadyAt: new Date("2026-11-13T11:59:00Z") })]);
    const [a, b] = await Promise.all([submit(t), submit(t)]);
    expect(a.ok && b.ok).toBe(true);
    expect(t.events.filter((e) => e.toStatus === "IN_REVIEW")).toHaveLength(1);
    await submit(t);
    expect(t.events.filter((e) => e.toStatus === "IN_REVIEW")).toHaveLength(1);

    const u = setupUpload([uploading()]);
    await submit(u);
    const firstAt = u.videos.get("v1")!.submittedAt;
    u.clock.now = new Date("2026-11-13T12:30:00Z");
    expect(await submit(u)).toEqual({ ok: true, videoId: "v1", completed: false });
    expect(u.videos.get("v1")!.submittedAt).toEqual(firstAt);
  });

  it("refuses a video that is Rejected or Approved", async () => {
    for (const status of ["REJECTED", "APPROVED"] as const) {
      const t = setupUpload([blank({ id: "v1", status })]);
      expect(await submit(t)).toEqual({ ok: false, reason: "wrong-status" });
    }
  });
});
