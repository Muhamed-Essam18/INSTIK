import { describe, expect, it } from "vitest";
import { parseMuxEvent, planFor, type MuxEvent, type VideoFiles } from "@/lib/mux/events";

const files = (extra: Partial<VideoFiles> = {}): VideoFiles => ({
  muxUploadId: "up-1",
  muxAssetId: null,
  pendingUploadId: null,
  pendingAssetId: null,
  ...extra,
});

describe("parseMuxEvent", () => {
  it("reads an upload that created an asset", () => {
    expect(parseMuxEvent({ type: "video.upload.asset_created", data: { id: "up-1", asset_id: "as-1" } })).toEqual({
      kind: "upload-asset-created",
      uploadId: "up-1",
      assetId: "as-1",
    });
  });

  it("reads an asset created from an upload the same way", () => {
    expect(parseMuxEvent({ type: "video.asset.created", data: { id: "as-1", upload_id: "up-1" } })).toEqual({
      kind: "upload-asset-created",
      uploadId: "up-1",
      assetId: "as-1",
    });
    expect(parseMuxEvent({ type: "video.asset.created", data: { id: "as-1" } })).toBeNull();
  });

  it("reads a ready asset with its length and the signed playback id", () => {
    expect(
      parseMuxEvent({
        type: "video.asset.ready",
        data: { id: "as-1", upload_id: "up-1", duration: 539.2, playback_ids: [{ id: "pub", policy: "public" }, { id: "sig", policy: "signed" }] },
      }),
    ).toEqual({ kind: "asset-ready", assetId: "as-1", uploadId: "up-1", durationSeconds: 539.2, playbackId: "sig" });
    expect(parseMuxEvent({ type: "video.asset.ready", data: { id: "as-1" } })).toMatchObject({ durationSeconds: 0, playbackId: null });
  });

  it("reads errors and ended uploads", () => {
    expect(parseMuxEvent({ type: "video.asset.errored", data: { id: "as-1" } })).toEqual({ kind: "asset-errored", assetId: "as-1" });
    expect(parseMuxEvent({ type: "video.upload.errored", data: { id: "up-1" } })).toEqual({ kind: "upload-ended", uploadId: "up-1" });
    expect(parseMuxEvent({ type: "video.upload.cancelled", data: { id: "up-1" } })).toEqual({ kind: "upload-ended", uploadId: "up-1" });
  });

  it("ignores unknown types and events whose fields cannot be read", () => {
    expect(parseMuxEvent({ type: "video.asset.updated", data: { id: "as-1" } })).toBeNull();
    expect(parseMuxEvent({ type: "video.asset.ready", data: {} })).toBeNull();
    expect(parseMuxEvent({ type: "video.asset.ready", data: { id: "as-1", duration: "long" } })).toBeNull();
    expect(parseMuxEvent({ type: "video.upload.asset_created", data: { id: "up-1" } })).toBeNull();
    expect(parseMuxEvent({ data: {} })).toBeNull();
    expect(parseMuxEvent("nope")).toBeNull();
    expect(parseMuxEvent(null)).toBeNull();
  });
});

describe("planFor: the current file", () => {
  it("stores the asset of the video's own upload", () => {
    const event: MuxEvent = { kind: "upload-asset-created", uploadId: "up-1", assetId: "as-1" };
    expect(planFor(event, files())).toEqual({ do: "store-asset", target: "current", assetId: "as-1" });
  });

  it("is fine to hear the same asset twice, and ignores a different asset for the same upload", () => {
    const event: MuxEvent = { kind: "upload-asset-created", uploadId: "up-1", assetId: "as-1" };
    expect(planFor(event, files({ muxAssetId: "as-1" }))).toEqual({ do: "store-asset", target: "current", assetId: "as-1" });
    expect(planFor(event, files({ muxAssetId: "as-9" }))).toEqual({ do: "ignore" });
  });

  it("marks a ready asset ready with the length rounded up to a whole second, at least 1", () => {
    const event = (durationSeconds: number): MuxEvent => ({ kind: "asset-ready", assetId: "as-1", uploadId: "up-1", durationSeconds, playbackId: "sig" });
    expect(planFor(event(539.2), files())).toEqual({ do: "ready", target: "current", assetId: "as-1", durationSeconds: 540, playbackId: "sig" });
    expect(planFor(event(0), files())).toMatchObject({ do: "ready", durationSeconds: 1 });
    expect(planFor(event(0.2), files())).toMatchObject({ do: "ready", durationSeconds: 1 });
  });

  it("accepts exactly 30 minutes and refuses one second more", () => {
    const event = (durationSeconds: number): MuxEvent => ({ kind: "asset-ready", assetId: "as-1", uploadId: "up-1", durationSeconds, playbackId: null });
    expect(planFor(event(1800), files())).toMatchObject({ do: "ready", durationSeconds: 1800 });
    expect(planFor(event(1801), files())).toEqual({ do: "too-long", target: "current", assetId: "as-1" });
  });

  it("finds the file by asset id when the notice carries no upload id", () => {
    const event: MuxEvent = { kind: "asset-ready", assetId: "as-1", durationSeconds: 10, playbackId: null };
    expect(planFor(event, files({ muxAssetId: "as-1" }))).toMatchObject({ do: "ready", target: "current" });
  });

  it("fails an errored asset, a cancelled upload and an errored upload", () => {
    expect(planFor({ kind: "asset-errored", assetId: "as-1", uploadId: "up-1" }, files())).toEqual({ do: "failed", target: "current" });
    expect(planFor({ kind: "upload-ended", uploadId: "up-1" }, files())).toEqual({ do: "failed", target: "current" });
  });
});

describe("planFor: a new version", () => {
  const pending = files({ muxUploadId: "up-1", muxAssetId: "as-1", pendingUploadId: "up-2" });

  it("reads the pending upload and asset as the pending file, never the current one", () => {
    expect(planFor({ kind: "upload-asset-created", uploadId: "up-2", assetId: "as-2" }, pending)).toEqual({
      do: "store-asset",
      target: "pending",
      assetId: "as-2",
    });
    expect(planFor({ kind: "asset-ready", assetId: "as-2", uploadId: "up-2", durationSeconds: 60, playbackId: "sig2" }, pending)).toMatchObject({
      do: "ready",
      target: "pending",
    });
    expect(planFor({ kind: "upload-ended", uploadId: "up-2" }, pending)).toEqual({ do: "failed", target: "pending" });
  });

  it("treats a too-long new version as the pending file's problem", () => {
    expect(planFor({ kind: "asset-ready", assetId: "as-2", uploadId: "up-2", durationSeconds: 2000, playbackId: null }, pending)).toEqual({
      do: "too-long",
      target: "pending",
      assetId: "as-2",
    });
  });
});

describe("planFor: files that are no longer the video's", () => {
  it("ignores a replaced upload or asset", () => {
    const video = files({ muxUploadId: "up-2", muxAssetId: "as-2" });
    expect(planFor({ kind: "asset-ready", assetId: "as-1", uploadId: "up-1", durationSeconds: 10, playbackId: null }, video)).toEqual({ do: "ignore" });
    expect(planFor({ kind: "asset-errored", assetId: "as-1" }, video)).toEqual({ do: "ignore" });
    expect(planFor({ kind: "upload-ended", uploadId: "up-1" }, video)).toEqual({ do: "ignore" });
    expect(planFor({ kind: "upload-asset-created", uploadId: "up-1", assetId: "as-1" }, video)).toEqual({ do: "ignore" });
  });

  it("ignores everything for a video with no files yet", () => {
    const none: VideoFiles = { muxUploadId: null, muxAssetId: null, pendingUploadId: null, pendingAssetId: null };
    expect(planFor({ kind: "upload-ended", uploadId: "up-1" }, none)).toEqual({ do: "ignore" });
  });
});
