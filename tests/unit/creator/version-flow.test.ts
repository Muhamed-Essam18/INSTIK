import { describe, expect, it } from "vitest";
import { CHECKLIST_ITEMS } from "@/lib/creator/rules";
import { blank, creator, learner, setupUpload, statusOf, type Rec } from "../../helpers/upload-memory";

const ticked = CHECKLIST_ITEMS.map(() => true);
const details = { title: "Taking the metro to work", description: "A trip.", proposedStage: "follow-it", topic: "daily-life" };
const earlier = new Date("2026-11-12T09:00:00Z");

const changes = (extra: Partial<Rec> = {}): Rec =>
  blank({
    id: "v1",
    slug: "taking-the-metro-to-work",
    title: "Taking the metro to work",
    status: "CHANGES_REQUESTED",
    muxUploadId: "up-1",
    muxAssetId: "as-1",
    assetReadyAt: earlier,
    playbackId: "old-playback",
    durationSeconds: 540,
    ...extra,
  });

const submit = (t: ReturnType<typeof setupUpload>, id = "v1") => t.service.submitVideo(creator("ann"), { videoId: id, details, checklist: ticked });

describe("a new version", () => {
  it("is held as a pending file and never changes the status or the history", async () => {
    const t = setupUpload([changes()]);
    const result = await t.service.createUpload(creator("ann"), { kind: "newVersion", videoId: "v1" });
    expect(result).toEqual({ ok: true, videoId: "v1", uploadUrl: "https://upload.example/1" });
    expect(t.videos.get("v1")).toMatchObject({
      status: "CHANGES_REQUESTED",
      pendingUploadId: "up-1",
      pendingStartedAt: t.clock.now,
      // The current file is untouched.
      muxUploadId: "up-1",
      muxAssetId: "as-1",
      playbackId: "old-playback",
      durationSeconds: 540,
    });
    expect(t.events).toHaveLength(0);
  });

  it("clears an earlier failure message and replaces a new version already on the way, deleting its asset", async () => {
    const t = setupUpload([changes({ pendingUploadId: "up-old", pendingAssetId: "as-old", pendingFailure: "The new version didn't work. Please try again." })]);
    await t.service.createUpload(creator("ann"), { kind: "newVersion", videoId: "v1" });
    expect(t.videos.get("v1")).toMatchObject({ pendingUploadId: "up-1", pendingAssetId: null, pendingFailure: null });
    expect(t.deleted).toEqual(["as-old"]);
  });

  it("is only offered in Changes requested: every other status is refused and makes no link", async () => {
    for (const status of ["DRAFT", "UPLOADING", "PROCESSING", "IN_REVIEW", "REJECTED", "APPROVED"] as const) {
      const t = setupUpload([blank({ id: "v1", status })]);
      expect(await t.service.createUpload(creator("ann"), { kind: "newVersion", videoId: "v1" })).toEqual({ ok: false, reason: "wrong-status" });
      expect(t.uploads).toHaveLength(0);
    }
  });

  it("is refused for a learner and for another creator, whose video looks missing", async () => {
    const t = setupUpload([changes()]);
    expect(await t.service.createUpload(learner, { kind: "newVersion", videoId: "v1" })).toEqual({ ok: false, reason: "not-allowed" });
    expect(await t.service.createUpload(creator("ben"), { kind: "newVersion", videoId: "v1" })).toEqual({ ok: false, reason: "not-found" });
    expect(t.uploads).toHaveLength(0);
  });

  it("leaves the video as it was when the video host will not make a link", async () => {
    const t = setupUpload([changes()], { hostFails: true });
    expect(await t.service.createUpload(creator("ann"), { kind: "newVersion", videoId: "v1" })).toEqual({ ok: false, reason: "host-error" });
    expect(t.videos.get("v1")).toMatchObject({ pendingUploadId: null, status: "CHANGES_REQUESTED" });
  });
});

describe("resubmitting after changes were requested", () => {
  it("remembers the submission while the new version is still processing, and the video stays in Changes requested", async () => {
    const t = setupUpload([changes({ pendingUploadId: "up-2", pendingAssetId: "as-2", pendingStartedAt: earlier })]);
    expect(await submit(t)).toEqual({ ok: true, videoId: "v1", completed: false });
    expect(t.videos.get("v1")).toMatchObject({ status: "CHANGES_REQUESTED", submittedAt: t.clock.now, muxAssetId: "as-1" });
    expect(t.events).toHaveLength(0);
  });

  it("swaps a ready new version in, goes to In review as the creator and deletes the old Mux asset", async () => {
    const t = setupUpload([
      changes({ pendingUploadId: "up-2", pendingAssetId: "as-2", pendingReadyAt: earlier, pendingPlaybackId: "new-playback", pendingDurationSeconds: 500 }),
    ]);
    expect(await submit(t)).toEqual({ ok: true, videoId: "v1", completed: true });
    expect(t.videos.get("v1")).toMatchObject({
      status: "IN_REVIEW",
      muxUploadId: "up-2",
      muxAssetId: "as-2",
      playbackId: "new-playback",
      durationSeconds: 500,
      pendingUploadId: null,
      pendingAssetId: null,
      pendingReadyAt: null,
      submittedAt: null,
    });
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ fromStatus: "CHANGES_REQUESTED", toStatus: "IN_REVIEW", actorId: "ann", actorLabel: "Ann" });
    expect(t.deleted).toEqual(["as-1"]);
  });

  it("needs the checklist ticked again and the details complete, and then changes nothing", async () => {
    const t = setupUpload([changes({ pendingUploadId: "up-2", pendingAssetId: "as-2", pendingReadyAt: earlier })]);
    const result = await t.service.submitVideo(creator("ann"), { videoId: "v1", details, checklist: [true, true, false, true, true] });
    expect(result.ok).toBe(false);
    expect(statusOf(t, "v1")).toBe("CHANGES_REQUESTED");
    expect(t.videos.get("v1")).toMatchObject({ muxAssetId: "as-1", pendingAssetId: "as-2", submittedAt: null });
    expect(t.deleted).toEqual([]);
  });

  it("goes to review at once after editing details only, when there is no new version and the file is ready", async () => {
    const t = setupUpload([changes()]);
    expect(await submit(t)).toEqual({ ok: true, videoId: "v1", completed: true });
    expect(statusOf(t, "v1")).toBe("IN_REVIEW");
    expect(t.deleted).toEqual([]);
    expect(t.videos.get("v1")!.slug).toBe("taking-the-metro-to-work");
  });

  it("is a double click away from one history entry", async () => {
    const t = setupUpload([changes()]);
    await Promise.all([submit(t), submit(t)]);
    await submit(t);
    expect(t.events.filter((e) => e.toStatus === "IN_REVIEW")).toHaveLength(1);
  });

  it("asks for a file when the video has neither a ready file nor a new version on the way", async () => {
    const t = setupUpload([changes({ assetReadyAt: null })]);
    const result = await submit(t);
    expect(result.ok).toBe(false);
  });
});

describe("a Rejected or Approved video", () => {
  it("offers no upload, no submit, no draft save and no delete", async () => {
    for (const status of ["REJECTED", "APPROVED", "IN_REVIEW"] as const) {
      const t = setupUpload([blank({ id: "v1", status })]);
      expect(await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toMatchObject({ ok: false });
      expect(await t.service.createUpload(creator("ann"), { kind: "newVersion", videoId: "v1" })).toMatchObject({ ok: false });
      expect(await t.service.saveDraft(creator("ann"), { videoId: "v1", details: { title: "x" } })).toMatchObject({ ok: false });
      expect(await t.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: false, reason: "wrong-status" });
      expect(t.videos.get("v1")!.deletedAt).toBeNull();
      expect(t.uploads).toHaveLength(0);
    }
  });
});

describe("deleting a draft", () => {
  const ready = () => blank({ id: "v1", status: "PROCESSING", muxUploadId: "up-1", muxAssetId: "as-1", assetReadyAt: earlier });

  it("works for a Draft, for a video ready to submit, and for an upload that did not finish", async () => {
    for (const rec of [
      blank({ id: "v1" }),
      ready(),
      blank({ id: "v1", status: "UPLOADING", muxUploadId: "up-1", uploadStartedAt: new Date("2026-11-13T10:00:00Z") }),
    ]) {
      const t = setupUpload([rec]);
      expect(await t.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: true });
      expect(t.videos.get("v1")!.deletedAt).toEqual(t.clock.now);
    }
  });

  it("hides the video, frees its slug, keeps its history and deletes its files at the video host", async () => {
    const t = setupUpload([{ ...ready(), slug: "visiting-grandma", pendingAssetId: "as-pending" }]);
    t.events.push({ videoId: "v1", fromStatus: "DRAFT", toStatus: "UPLOADING", actorId: "ann", actorLabel: "Ann", note: null });
    expect(await t.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: true });
    expect(await t.store.getVideo("ann", "v1")).toBeNull();
    expect(t.videos.get("v1")!.slug).toBe("draft-v1");
    expect(await t.store.slugTaken("arz", "visiting-grandma", "other")).toBe(false);
    expect(t.events).toHaveLength(1); // nothing is removed or added to the history
    expect(t.deleted.sort()).toEqual(["as-1", "as-pending"]);
    // The row itself is still there.
    expect(t.videos.has("v1")).toBe(true);
  });

  it("is refused when the video is processing, in review, in Changes requested, rejected or live", async () => {
    for (const status of ["PROCESSING", "IN_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED"] as const) {
      const t = setupUpload([blank({ id: "v1", status })]);
      expect(await t.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: false, reason: "wrong-status" });
    }
    const uploading = setupUpload([blank({ id: "v1", status: "UPLOADING", uploadStartedAt: new Date("2026-11-13T11:55:00Z") })]);
    expect(await uploading.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: false, reason: "wrong-status" });
  });

  it("is refused for a learner and for another creator, and a deleted video cannot be deleted twice", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    expect(await t.service.deleteDraft(learner, "v1")).toEqual({ ok: false, reason: "not-allowed" });
    expect(await t.service.deleteDraft(creator("ben"), "v1")).toEqual({ ok: false, reason: "not-found" });
    expect(await t.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: true });
    expect(await t.service.deleteDraft(creator("ann"), "v1")).toEqual({ ok: false, reason: "not-found" });
  });

  it("makes every action on a deleted video look like a missing video", async () => {
    const t = setupUpload([blank({ id: "v1" })]);
    await t.service.deleteDraft(creator("ann"), "v1");
    expect(await t.service.createUpload(creator("ann"), { kind: "first", videoId: "v1" })).toEqual({ ok: false, reason: "not-found" });
    expect(await t.service.saveDraft(creator("ann"), { videoId: "v1", details: { title: "x" } })).toEqual({ ok: false, reason: "not-found" });
    expect(await submit(t)).toEqual({ ok: false, reason: "not-found" });
  });
});
