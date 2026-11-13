import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOO_LONG_NOTE, type VideoStatusName } from "@/lib/content/status";
import { createStatusService, type StatusEventInput, type StatusStore, type StatusTx } from "@/lib/content/status-service";
import type { MuxEvent, Target } from "@/lib/mux/events";
import { NEW_VERSION_FAILED_MESSAGE, createWebhookService, type WebhookStore, type WebhookVideo } from "@/lib/mux/webhook-service";

// The webhook service against an in-memory store and the real status service: what each Mux notice does to a video, including
// repeats and notices that arrive out of order.

type Rec = {
  id: string;
  status: VideoStatusName;
  hostUserId: string;
  muxUploadId: string | null;
  muxAssetId: string | null;
  playbackId: string | null;
  durationSeconds: number | null;
  assetReadyAt: Date | null;
  submittedAt: Date | null;
  pendingUploadId: string | null;
  pendingAssetId: string | null;
  pendingPlaybackId: string | null;
  pendingDurationSeconds: number | null;
  pendingReadyAt: Date | null;
  pendingFailure: string | null;
};

const base = (extra: Partial<Rec> & Pick<Rec, "id" | "status">): Rec => ({
  hostUserId: "ann",
  muxUploadId: null,
  muxAssetId: null,
  playbackId: null,
  durationSeconds: null,
  assetReadyAt: null,
  submittedAt: null,
  pendingUploadId: null,
  pendingAssetId: null,
  pendingPlaybackId: null,
  pendingDurationSeconds: null,
  pendingReadyAt: null,
  pendingFailure: null,
  ...extra,
});

function setup(initial: Rec[]) {
  const videos = new Map(initial.map((v) => [v.id, v]));
  const events: StatusEventInput[] = [];
  const deleted: string[] = [];
  const tx: StatusTx = {
    getVideo: async (id) => {
      const v = videos.get(id);
      return v ? { id: v.id, status: v.status, hostUserId: v.hostUserId } : null;
    },
    setStatus: async (id, from, to) => {
      const v = videos.get(id);
      if (!v || v.status !== from) return false;
      v.status = to;
      return true;
    },
    appendEvent: async (e) => {
      events.push(e);
    },
  };
  const statusStore: StatusStore = { transaction: (work) => work(tx) };
  const status = createStatusService({ store: statusStore });

  const toWebhook = (v: Rec): WebhookVideo => ({
    id: v.id,
    status: v.status,
    submittedAt: v.submittedAt,
    assetReadyAt: v.assetReadyAt,
    pendingReadyAt: v.pendingReadyAt,
    muxUploadId: v.muxUploadId,
    muxAssetId: v.muxAssetId,
    pendingUploadId: v.pendingUploadId,
    pendingAssetId: v.pendingAssetId,
    creator: { id: v.hostUserId, email: `${v.hostUserId}@x.com`, name: "Ann" },
  });
  const store: WebhookStore = {
    findByUploadId: async (id) => {
      const v = [...videos.values()].find((x) => x.muxUploadId === id || x.pendingUploadId === id);
      return v ? toWebhook(v) : null;
    },
    findByAssetId: async (id) => {
      const v = [...videos.values()].find((x) => x.muxAssetId === id || x.pendingAssetId === id);
      return v ? toWebhook(v) : null;
    },
    storeAsset: async (id, target: Target, assetId) => {
      const v = videos.get(id)!;
      if (target === "current") v.muxAssetId ??= assetId;
      else v.pendingAssetId ??= assetId;
    },
    markReady: async (id, target, ready) => {
      const v = videos.get(id)!;
      if (target === "current") {
        v.muxAssetId ??= ready.assetId;
        v.assetReadyAt ??= ready.at;
        v.durationSeconds = ready.durationSeconds;
        v.playbackId = ready.playbackId;
      } else {
        v.pendingAssetId ??= ready.assetId;
        v.pendingReadyAt ??= ready.at;
        v.pendingDurationSeconds = ready.durationSeconds;
        v.pendingPlaybackId = ready.playbackId;
      }
    },
    failPending: async (id, message) => {
      const v = videos.get(id)!;
      const asset = v.pendingAssetId;
      Object.assign(v, {
        pendingUploadId: null,
        pendingAssetId: null,
        pendingPlaybackId: null,
        pendingDurationSeconds: null,
        pendingReadyAt: null,
        pendingFailure: message,
        submittedAt: null,
      });
      return asset;
    },
    swapPending: async (id) => {
      const v = videos.get(id)!;
      if (!v.pendingReadyAt) return "none";
      const previousAssetId = v.muxAssetId;
      Object.assign(v, {
        muxUploadId: v.pendingUploadId,
        muxAssetId: v.pendingAssetId,
        playbackId: v.pendingPlaybackId,
        durationSeconds: v.pendingDurationSeconds,
        assetReadyAt: v.pendingReadyAt,
        pendingUploadId: null,
        pendingAssetId: null,
        pendingPlaybackId: null,
        pendingDurationSeconds: null,
        pendingReadyAt: null,
      });
      return { previousAssetId };
    },
    clearSubmitted: async (id) => {
      videos.get(id)!.submittedAt = null;
    },
  };
  const host = { deleteAsset: vi.fn(async (id: string) => void deleted.push(id)) };
  const service = createWebhookService({ store, host, changeStatus: status.changeStatus, now: () => new Date("2026-11-13T12:00:00Z") });
  return { videos, events, deleted, host, service };
}

const created = (uploadId: string, assetId: string): MuxEvent => ({ kind: "upload-asset-created", uploadId, assetId });
const ready = (assetId: string, uploadId: string | undefined, durationSeconds = 120): MuxEvent => ({
  kind: "asset-ready",
  assetId,
  ...(uploadId ? { uploadId } : {}),
  durationSeconds,
  playbackId: "sig-playback",
});
const submitted = new Date("2026-11-13T10:00:00Z");

describe("a first upload", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup([base({ id: "v1", status: "UPLOADING", muxUploadId: "up-1" })]);
  });

  it("stores the asset and moves from Uploading to Processing, once", async () => {
    expect(await t.service.handle(created("up-1", "as-1"))).toBe("applied");
    expect(t.videos.get("v1")).toMatchObject({ status: "PROCESSING", muxAssetId: "as-1" });
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ fromStatus: "UPLOADING", toStatus: "PROCESSING", actorId: null, actorLabel: "Instik" });
    await t.service.handle(created("up-1", "as-1"));
    expect(t.events).toHaveLength(1);
  });

  it("stays in Processing when the asset is ready but the creator has not submitted (Ready to submit)", async () => {
    await t.service.handle(created("up-1", "as-1"));
    await t.service.handle(ready("as-1", "up-1", 539.2));
    expect(t.videos.get("v1")).toMatchObject({ status: "PROCESSING", durationSeconds: 540, playbackId: "sig-playback" });
    expect(t.videos.get("v1")!.assetReadyAt).toBeInstanceOf(Date);
    expect(t.events).toHaveLength(1);
  });

  it("goes to In review as the creator when it is ready after they submitted", async () => {
    await t.service.handle(created("up-1", "as-1"));
    t.videos.get("v1")!.submittedAt = submitted;
    await t.service.handle(ready("as-1", "up-1"));
    expect(t.videos.get("v1")).toMatchObject({ status: "IN_REVIEW", submittedAt: null });
    expect(t.events.at(-1)).toMatchObject({ fromStatus: "PROCESSING", toStatus: "IN_REVIEW", actorId: "ann", actorLabel: "Ann" });
  });

  it("makes one history entry per real change when the same notices come twice and out of order", async () => {
    t.videos.get("v1")!.submittedAt = submitted;
    // The ready notice beats the asset-created notice.
    await t.service.handle(ready("as-1", "up-1"));
    await t.service.handle(created("up-1", "as-1"));
    await t.service.handle(ready("as-1", "up-1"));
    await t.service.handle(created("up-1", "as-1"));
    expect(t.videos.get("v1")!.status).toBe("IN_REVIEW");
    expect(t.events.map((e) => `${e.fromStatus}>${e.toStatus}`)).toEqual(["UPLOADING>PROCESSING", "PROCESSING>IN_REVIEW"]);
  });

  it("sends an errored asset back to Draft with the plain note, and an errored or cancelled upload too", async () => {
    await t.service.handle(created("up-1", "as-1"));
    await t.service.handle({ kind: "asset-errored", assetId: "as-1", uploadId: "up-1" });
    expect(t.videos.get("v1")!.status).toBe("DRAFT");
    expect(t.events.at(-1)).toMatchObject({ fromStatus: "PROCESSING", toStatus: "DRAFT", note: "The upload didn't work. Please try again." });

    const other = setup([base({ id: "v2", status: "UPLOADING", muxUploadId: "up-2" })]);
    await other.service.handle({ kind: "upload-ended", uploadId: "up-2" });
    expect(other.videos.get("v2")!.status).toBe("DRAFT");
    expect(other.events[0]).toMatchObject({ fromStatus: "UPLOADING", note: "The upload didn't work. Please try again." });
    await other.service.handle({ kind: "upload-ended", uploadId: "up-2" });
    expect(other.events).toHaveLength(1);
  });

  it("sends a video over 30 minutes back to Draft with the too-long note and deletes its asset", async () => {
    await t.service.handle(created("up-1", "as-1"));
    await t.service.handle(ready("as-1", "up-1", 1801));
    expect(t.videos.get("v1")!.status).toBe("DRAFT");
    expect(t.events.at(-1)).toMatchObject({ toStatus: "DRAFT", note: TOO_LONG_NOTE });
    expect(t.deleted).toEqual(["as-1"]);
  });

  it("accepts exactly 30 minutes", async () => {
    await t.service.handle(created("up-1", "as-1"));
    await t.service.handle(ready("as-1", "up-1", 1800));
    expect(t.videos.get("v1")).toMatchObject({ status: "PROCESSING", durationSeconds: 1800 });
  });

  it("changes nothing for a notice about a file that is not the video's", async () => {
    await t.service.handle(created("up-1", "as-1"));
    const before = JSON.stringify([...t.videos.values()]);
    expect(await t.service.handle(ready("as-9", "up-9"))).toBe("ignored");
    expect(await t.service.handle({ kind: "upload-ended", uploadId: "up-9" })).toBe("ignored");
    expect(await t.service.handle({ kind: "asset-errored", assetId: "as-9" })).toBe("ignored");
    expect(JSON.stringify([...t.videos.values()])).toBe(before);
    expect(t.events).toHaveLength(1);
  });

  it("changes nothing for a video that went back to Draft (a late notice)", async () => {
    await t.service.handle(created("up-1", "as-1"));
    await t.service.handle({ kind: "asset-errored", assetId: "as-1", uploadId: "up-1" });
    const events = t.events.length;
    await t.service.handle(ready("as-1", "up-1"));
    expect(t.videos.get("v1")!.status).toBe("DRAFT");
    expect(t.events).toHaveLength(events);
  });
});

describe("a new version in Changes requested", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup([
      base({
        id: "v1",
        status: "CHANGES_REQUESTED",
        muxUploadId: "up-1",
        muxAssetId: "as-1",
        assetReadyAt: new Date("2026-11-01"),
        playbackId: "old-playback",
        durationSeconds: 100,
        pendingUploadId: "up-2",
      }),
    ]);
  });

  it("updates only the pending fields and never the status or the history", async () => {
    await t.service.handle(created("up-2", "as-2"));
    await t.service.handle(ready("as-2", "up-2", 90));
    expect(t.videos.get("v1")).toMatchObject({
      status: "CHANGES_REQUESTED",
      muxAssetId: "as-1",
      playbackId: "old-playback",
      durationSeconds: 100,
      pendingAssetId: "as-2",
      pendingPlaybackId: "sig-playback",
      pendingDurationSeconds: 90,
    });
    expect(t.videos.get("v1")!.pendingReadyAt).toBeInstanceOf(Date);
    expect(t.events).toHaveLength(0);
  });

  it("swaps the new file in, goes to In review as the creator and deletes the old asset when it is ready after the creator submitted", async () => {
    await t.service.handle(created("up-2", "as-2"));
    t.videos.get("v1")!.submittedAt = submitted;
    await t.service.handle(ready("as-2", "up-2", 90));
    expect(t.videos.get("v1")).toMatchObject({
      status: "IN_REVIEW",
      muxUploadId: "up-2",
      muxAssetId: "as-2",
      playbackId: "sig-playback",
      durationSeconds: 90,
      pendingUploadId: null,
      pendingAssetId: null,
      submittedAt: null,
    });
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ fromStatus: "CHANGES_REQUESTED", toStatus: "IN_REVIEW", actorId: "ann" });
    expect(t.deleted).toEqual(["as-1"]);
    // The same notice again changes nothing.
    await t.service.handle(ready("as-2", "up-2", 90));
    expect(t.events).toHaveLength(1);
    expect(t.deleted).toEqual(["as-1"]);
  });

  it("keeps the earlier file and the status when the new version errors, is cancelled or is over 30 minutes", async () => {
    await t.service.handle(created("up-2", "as-2"));
    t.videos.get("v1")!.submittedAt = submitted;
    await t.service.handle({ kind: "asset-errored", assetId: "as-2", uploadId: "up-2" });
    expect(t.videos.get("v1")).toMatchObject({
      status: "CHANGES_REQUESTED",
      muxAssetId: "as-1",
      pendingUploadId: null,
      pendingAssetId: null,
      pendingFailure: NEW_VERSION_FAILED_MESSAGE,
      submittedAt: null,
    });
    expect(t.deleted).toEqual(["as-2"]);

    t.videos.get("v1")!.pendingUploadId = "up-3";
    await t.service.handle(created("up-3", "as-3"));
    await t.service.handle(ready("as-3", "up-3", 1900));
    expect(t.videos.get("v1")).toMatchObject({ status: "CHANGES_REQUESTED", pendingAssetId: null, pendingFailure: TOO_LONG_NOTE });
    expect(t.deleted).toEqual(["as-2", "as-3"]);

    t.videos.get("v1")!.pendingUploadId = "up-4";
    await t.service.handle({ kind: "upload-ended", uploadId: "up-4" });
    expect(t.videos.get("v1")!.pendingFailure).toBe(NEW_VERSION_FAILED_MESSAGE);
    expect(t.events).toHaveLength(0);
  });

  it("does not let a notice about the current file touch the pending one", async () => {
    await t.service.handle({ kind: "asset-errored", assetId: "as-1", uploadId: "up-1" });
    expect(t.videos.get("v1")).toMatchObject({ status: "CHANGES_REQUESTED", pendingUploadId: "up-2" });
    expect(t.events).toHaveLength(0);
  });
});

describe("unknown videos", () => {
  it("changes nothing when no video has the file", async () => {
    const t = setup([base({ id: "v1", status: "UPLOADING", muxUploadId: "up-1" })]);
    expect(await t.service.handle(created("up-nope", "as-1"))).toBe("ignored");
    expect(t.events).toHaveLength(0);
  });
});
