import { vi } from "vitest";
import type { VideoStatusName } from "@/lib/content/status";
import { createStatusService, type StatusEventInput, type StatusStore, type StatusTx } from "@/lib/content/status-service";
import type { Actor } from "@/lib/roles/actor";
import { createUploadService, type HostRecord, type UploadStore, type VideoRecord } from "@/lib/creator/upload-service";

// An in-memory stand-in for the creator upload store, the video host and the status store, so the upload service's rules run
// with no database and no Mux. Videos belong to hosts, hosts to users: a creator only ever finds their own.

export type Rec = VideoRecord & {
  hostUserId: string;
  deletedAt: Date | null;
  checklistAcceptedAt: Date | null;
  pendingFailure: string | null;
  playbackId: string | null;
  durationSeconds: number | null;
  pendingPlaybackId: string | null;
  pendingDurationSeconds: number | null;
};

export const blank = (extra: Partial<Rec> & Pick<Rec, "id">): Rec => ({
  hostId: "host-ann",
  hostUserId: "ann",
  languageCode: "arz",
  slug: `draft-${extra.id}`,
  title: "",
  description: null,
  proposedStage: null,
  topic: null,
  status: "DRAFT",
  submittedAt: null,
  assetReadyAt: null,
  uploadStartedAt: null,
  muxUploadId: null,
  muxAssetId: null,
  pendingUploadId: null,
  pendingAssetId: null,
  pendingReadyAt: null,
  pendingStartedAt: null,
  deletedAt: null,
  checklistAcceptedAt: null,
  pendingFailure: null,
  playbackId: null,
  durationSeconds: null,
  pendingPlaybackId: null,
  pendingDurationSeconds: null,
  ...extra,
});

export const creator = (id: string): Actor => ({ id, email: `${id}@x.com`, name: id === "ann" ? "Ann" : "Ben", role: "creator" });
export const learner: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };
export const plainOwner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };

export type Setup = ReturnType<typeof setupUpload>;

export function setupUpload(
  initial: Rec[] = [],
  options: { hostsComplete?: Record<string, boolean>; hostFails?: boolean; clock?: { now: Date } } = {},
) {
  const videos = new Map(initial.map((v) => [v.id, v]));
  const hosts = new Map<string, HostRecord & { userId: string }>([
    ["ann", { id: "host-ann", userId: "ann", languageCode: "arz", complete: options.hostsComplete?.ann ?? true }],
    ["ben", { id: "host-ben", userId: "ben", languageCode: "arz", complete: options.hostsComplete?.ben ?? true }],
  ]);
  const events: StatusEventInput[] = [];
  const clock = options.clock ?? { now: new Date("2026-11-13T12:00:00Z") };
  let counter = 0;

  const statusTx: StatusTx = {
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
  const statusStore: StatusStore = { transaction: (work) => work(statusTx) };
  const status = createStatusService({ store: statusStore });

  const pick = (v: Rec): VideoRecord => ({
    id: v.id,
    hostId: v.hostId,
    languageCode: v.languageCode,
    slug: v.slug,
    title: v.title,
    description: v.description,
    proposedStage: v.proposedStage,
    topic: v.topic,
    status: v.status,
    submittedAt: v.submittedAt,
    assetReadyAt: v.assetReadyAt,
    uploadStartedAt: v.uploadStartedAt,
    muxUploadId: v.muxUploadId,
    muxAssetId: v.muxAssetId,
    pendingUploadId: v.pendingUploadId,
    pendingAssetId: v.pendingAssetId,
    pendingReadyAt: v.pendingReadyAt,
    pendingStartedAt: v.pendingStartedAt,
  });
  const clearPendingFields = (v: Rec) =>
    Object.assign(v, {
      pendingUploadId: null,
      pendingAssetId: null,
      pendingPlaybackId: null,
      pendingDurationSeconds: null,
      pendingReadyAt: null,
      pendingStartedAt: null,
    });

  const store: UploadStore = {
    getHost: async (actorId) => {
      const h = hosts.get(actorId);
      return h ? { id: h.id, languageCode: h.languageCode, complete: h.complete } : null;
    },
    getVideo: async (actorId, videoId) => {
      const v = videos.get(videoId);
      return v && !v.deletedAt && v.hostUserId === actorId ? pick(v) : null;
    },
    createDraft: async (host, details) => {
      const id = `new-${++counter}`;
      const owner = [...hosts.values()].find((h) => h.id === host.id)!;
      const v = blank({
        id,
        hostId: host.id,
        hostUserId: owner.userId,
        title: details.title?.trim() ?? "",
        description: details.description ?? null,
        proposedStage: details.proposedStage ?? null,
        topic: details.topic ?? null,
      });
      videos.set(id, v);
      return pick(v);
    },
    saveDetails: async (id, d) => {
      const v = videos.get(id)!;
      if (d.title !== undefined) v.title = d.title?.trim() ?? "";
      if (d.description !== undefined) v.description = d.description?.trim() || null;
      if (d.proposedStage !== undefined) v.proposedStage = d.proposedStage || null;
      if (d.topic !== undefined) v.topic = d.topic || null;
    },
    setFirstUpload: async (id, u) => {
      Object.assign(videos.get(id)!, {
        muxUploadId: u.uploadId,
        uploadStartedAt: u.startedAt,
        muxAssetId: null,
        playbackId: null,
        durationSeconds: null,
        assetReadyAt: null,
        submittedAt: null,
      });
    },
    setPendingUpload: async (id, u) => {
      const v = videos.get(id)!;
      clearPendingFields(v);
      Object.assign(v, { pendingUploadId: u.uploadId, pendingStartedAt: u.startedAt, pendingFailure: null, submittedAt: null });
    },
    clearPending: async (id) => {
      const v = videos.get(id)!;
      const asset = v.pendingAssetId;
      clearPendingFields(v);
      return asset;
    },
    slugTaken: async (languageCode, slug, except) =>
      [...videos.values()].some((v) => v.languageCode === languageCode && v.slug === slug && v.id !== except),
    setSlug: async (id, slug) => {
      videos.get(id)!.slug = slug;
    },
    markSubmitted: async (id, at) => {
      Object.assign(videos.get(id)!, { submittedAt: at, checklistAcceptedAt: at });
    },
    clearSubmitted: async (id) => {
      videos.get(id)!.submittedAt = null;
    },
    swapPending: async (id) => {
      const v = videos.get(id)!;
      if (!v.pendingReadyAt || !v.pendingAssetId) return "none";
      const previousAssetId = v.muxAssetId;
      Object.assign(v, {
        muxUploadId: v.pendingUploadId,
        muxAssetId: v.pendingAssetId,
        playbackId: v.pendingPlaybackId,
        durationSeconds: v.pendingDurationSeconds,
        assetReadyAt: v.pendingReadyAt,
        pendingFailure: null,
      });
      clearPendingFields(v);
      return { previousAssetId };
    },
    softDelete: async (id, at) => {
      const v = videos.get(id)!;
      const assetIds = [v.muxAssetId, v.pendingAssetId].filter((x): x is string => Boolean(x));
      Object.assign(v, { deletedAt: at, slug: `draft-${id}` });
      return { assetIds };
    },
  };

  const uploads: { corsOrigin: string; videoId: string }[] = [];
  const deleted: string[] = [];
  const host = {
    createDirectUpload: vi.fn(async (input: { corsOrigin: string; videoId: string }) => {
      if (options.hostFails) throw new Error("mux is down");
      uploads.push(input);
      return { id: `up-${uploads.length}`, url: `https://upload.example/${uploads.length}` };
    }),
    deleteAsset: vi.fn(async (id: string) => void deleted.push(id)),
  };

  const service = createUploadService({
    store,
    host,
    changeStatus: status.changeStatus,
    siteOrigin: () => "http://localhost:3000",
    now: () => clock.now,
  });

  return { videos, hosts, events, uploads, deleted, host, service, clock, status, store };
}

export const statusOf = (s: Setup, id: string): VideoStatusName => s.videos.get(id)!.status;
