import { describe, expect, it, vi } from "vitest";
import { canUpload } from "@/lib/creator/can-upload";
import { createHostService, type HostStore, type PhotoStore } from "@/lib/creator/host-service";
import type { Actor } from "@/lib/roles/actor";
import { blank, creator, learner, plainOwner, setupUpload } from "../../helpers/upload-memory";

const paused = (id = "ann"): Actor => ({ ...creator(id), paused: true });
const details = { title: "A trip", description: "A trip.", proposedStage: "follow-it", topic: "daily-life" };

describe("canUpload and a paused creator", () => {
  it("is false for a paused creator and true for an active one", () => {
    expect(canUpload({ role: "creator", paused: true })).toBe(false);
    expect(canUpload({ role: "creator", paused: false })).toBe(true);
    expect(canUpload({ role: "creator" })).toBe(true);
  });
  it("is false for an owner who is also a paused creator", () => {
    expect(canUpload({ role: "owner", isCreator: true, paused: true })).toBe(false);
  });
  it("is false for a learner and an owner who is not a creator", () => {
    expect(canUpload({ role: "learner" })).toBe(false);
    expect(canUpload({ role: "owner" })).toBe(false);
  });
});

describe("a paused creator cannot write through the upload service", () => {
  const refused = { ok: false, reason: "not-allowed" };

  it("createUpload (first upload and new version)", async () => {
    const t = setupUpload([blank({ id: "d1" }), blank({ id: "c1", status: "CHANGES_REQUESTED" })]);
    expect(await t.service.createUpload(paused(), { kind: "first", videoId: "d1" })).toEqual(refused);
    expect(await t.service.createUpload(paused(), { kind: "newVersion", videoId: "c1" })).toEqual(refused);
    expect(t.uploads).toHaveLength(0);
    expect(t.videos.get("d1")!.status).toBe("DRAFT");
  });

  it("saveDraft", async () => {
    const t = setupUpload([blank({ id: "d1" })]);
    expect(await t.service.saveDraft(paused(), { videoId: "d1", details })).toEqual(refused);
    expect(await t.service.saveDraft(paused(), { details })).toEqual(refused);
    expect(t.videos.get("d1")!.title).toBe("");
    expect(t.videos.size).toBe(1);
  });

  it("submitVideo", async () => {
    const t = setupUpload([blank({ id: "d1", status: "PROCESSING", assetReadyAt: new Date() })]);
    expect(await t.service.submitVideo(paused(), { videoId: "d1", details, checklist: [true, true, true, true, true] })).toEqual(refused);
    expect(t.videos.get("d1")!.status).toBe("PROCESSING");
  });

  it("deleteDraft", async () => {
    const t = setupUpload([blank({ id: "d1" })]);
    expect(await t.service.deleteDraft(paused(), "d1")).toEqual(refused);
    expect(t.videos.get("d1")!.deletedAt).toBeNull();
  });

  it("works for the same creator when active", async () => {
    const t = setupUpload([blank({ id: "d1" })]);
    expect(await t.service.saveDraft(creator("ann"), { videoId: "d1", details })).toEqual({ ok: true, videoId: "d1" });
    expect((await t.service.createUpload(creator("ann"), { kind: "first", videoId: "d1" })).ok).toBe(true);
    expect((await t.service.deleteDraft(creator("ann"), "d1")).ok).toBe(false); // wrong status after upload started, but not refused as not-allowed
  });

  it("is refused for learners and owners who are not creators, as before", async () => {
    const t = setupUpload([blank({ id: "d1" })]);
    for (const actor of [learner, plainOwner]) expect(await t.service.saveDraft(actor, { videoId: "d1", details })).toEqual(refused);
  });
});

describe("a paused creator cannot edit their host page", () => {
  const jpeg = Uint8Array.from({ length: 100 }, (_, i) => [0xff, 0xd8, 0xff, 0xe0][i] ?? 0);
  const good = { name: "Ann", nameArabic: "آن", story: "Hello.", topics: ["Food"] };
  const build = () => {
    const saved: unknown[] = [];
    const store: HostStore = {
      getOwnHost: async () => ({ id: "host-ann", photo: null }),
      saveHost: async (_id, value) => void saved.push(value),
      setPhoto: async () => {},
    };
    const photos: PhotoStore = { put: vi.fn(async () => "https://blob.example/p.jpg"), remove: vi.fn(async () => {}) };
    return { saved, photos, service: createHostService({ store, photos }) };
  };

  it("saveHost and uploadPhoto return not-allowed and write nothing", async () => {
    const t = build();
    expect(await t.service.saveHost(paused(), good)).toEqual({ ok: false, reason: "not-allowed" });
    expect(await t.service.uploadPhoto(paused(), jpeg)).toEqual({ ok: false, reason: "not-allowed" });
    expect(t.saved).toHaveLength(0);
    expect(t.photos.put).not.toHaveBeenCalled();
  });

  it("also refuses an owner who is a paused creator", async () => {
    const t = build();
    const owner: Actor = { id: "ann", email: "a@x.com", name: "Ann", role: "owner", isCreator: true, paused: true };
    expect(await t.service.saveHost(owner, good)).toEqual({ ok: false, reason: "not-allowed" });
  });

  it("works for an active creator", async () => {
    const t = build();
    expect(await t.service.saveHost(creator("ann"), good)).toEqual({ ok: true });
    expect((await t.service.uploadPhoto(creator("ann"), jpeg)).ok).toBe(true);
  });
});

describe("a paused creator can still read", () => {
  it("the upload service has no read function that checks canUpload (My videos and the host page read through their own reads)", () => {
    const t = setupUpload();
    expect(Object.keys(t.service).sort()).toEqual(["createUpload", "deleteDraft", "saveDraft", "submitVideo"]);
  });
});
