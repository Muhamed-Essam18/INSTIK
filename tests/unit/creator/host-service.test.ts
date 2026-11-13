import { describe, expect, it, vi } from "vitest";
import { PHOTO_MAX_BYTES, PHOTO_SIZE_MESSAGE, PHOTO_TYPE_MESSAGE } from "@/lib/creator/host-rules";
import { createHostService, type HostStore, type PhotoStore } from "@/lib/creator/host-service";
import { hostFailureMessage } from "@/lib/creator/messages";
import type { Actor } from "@/lib/roles/actor";

const creator = (id: string): Actor => ({ id, email: `${id}@x.com`, name: id, role: "creator" });
const learner: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };
const plainOwner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };
const ownerWhoIsCreator: Actor = { id: "ann", email: "ann@x.com", name: "Ann", role: "owner", isCreator: true };

const jpeg = (length = 100) => Uint8Array.from({ length }, (_, i) => [0xff, 0xd8, 0xff, 0xe0][i] ?? 0);
const pdf = () => Uint8Array.from({ length: 100 }, (_, i) => [0x25, 0x50, 0x44, 0x46][i] ?? 0);
const good = { name: "Ann", nameArabic: "آن", story: "Hello.", topics: ["Food"] };

function setup(options: { putFails?: boolean; setPhotoFails?: boolean; photo?: string | null } = {}) {
  const hosts = new Map([
    ["ann", { id: "host-ann", photo: options.photo ?? null, name: "Old Ann", nameArabic: null as string | null, story: "", topics: [] as string[] }],
    ["ben", { id: "host-ben", photo: null, name: "Ben", nameArabic: null, story: "", topics: [] }],
  ]);
  const store: HostStore = {
    getOwnHost: async (actorId) => {
      const h = hosts.get(actorId);
      return h ? { id: h.id, photo: h.photo } : null;
    },
    saveHost: async (id, value) => {
      Object.assign([...hosts.values()].find((h) => h.id === id)!, value);
    },
    setPhoto: async (id, url) => {
      if (options.setPhotoFails) throw new Error("db down");
      [...hosts.values()].find((h) => h.id === id)!.photo = url;
    },
  };
  const stored: string[] = [];
  const removed: string[] = [];
  const photos: PhotoStore = {
    put: vi.fn(async ({ hostId, ext }) => {
      if (options.putFails) throw new Error("blob down");
      const url = `https://blob.example/host-photos/${hostId}/new-${stored.length + 1}.${ext}`;
      stored.push(url);
      return url;
    }),
    remove: vi.fn(async (url: string) => void removed.push(url)),
  };
  return { hosts, store, photos, stored, removed, service: createHostService({ store, photos }) };
}

describe("saveHost", () => {
  it("saves a creator's own page and nobody else's", async () => {
    const t = setup();
    expect(await t.service.saveHost(creator("ann"), good)).toEqual({ ok: true });
    expect(t.hosts.get("ann")).toMatchObject({ name: "Ann", nameArabic: "آن", story: "Hello.", topics: ["Food"] });
    expect(t.hosts.get("ben")).toMatchObject({ name: "Ben", nameArabic: null });
  });

  it("is refused for a learner, an owner who is not a creator and nobody, and changes nothing", async () => {
    const t = setup();
    for (const actor of [learner, plainOwner, null]) {
      expect(await t.service.saveHost(actor, good)).toEqual({ ok: false, reason: "not-allowed" });
    }
    expect(t.hosts.get("ann")!.name).toBe("Old Ann");
  });

  it("lets an owner who is also a creator edit their own page", async () => {
    const t = setup();
    expect(await t.service.saveHost(ownerWhoIsCreator, good)).toEqual({ ok: true });
  });

  it("says a creator with no host page has none", async () => {
    const t = setup();
    expect(await t.service.saveHost(creator("zoe"), good)).toEqual({ ok: false, reason: "not-found" });
  });

  it("names each field left empty and saves nothing", async () => {
    const t = setup();
    const result = await t.service.saveHost(creator("ann"), { ...good, name: "", story: "" });
    expect(result).toMatchObject({ ok: false, reason: "invalid", fields: { name: expect.any(String), story: expect.any(String) } });
    expect(t.hosts.get("ann")!.name).toBe("Old Ann");
  });
});

describe("uploadPhoto", () => {
  it("stores a real photo under the creator's own host and shows it", async () => {
    const t = setup();
    const result = await t.service.uploadPhoto(creator("ann"), jpeg());
    expect(result).toEqual({ ok: true, photo: "https://blob.example/host-photos/host-ann/new-1.jpg" });
    expect(t.hosts.get("ann")!.photo).toBe("https://blob.example/host-photos/host-ann/new-1.jpg");
    expect(t.hosts.get("ben")!.photo).toBeNull();
  });

  it("deletes the old photo only after the new one is saved", async () => {
    const t = setup({ photo: "https://blob.example/host-photos/host-ann/old.jpg" });
    await t.service.uploadPhoto(creator("ann"), jpeg());
    expect(t.removed).toEqual(["https://blob.example/host-photos/host-ann/old.jpg"]);
  });

  it("refuses a file that is not an image, or is over 2 MB, with a plain message and keeps the old photo", async () => {
    const t = setup({ photo: "https://blob.example/old.jpg" });
    expect(await t.service.uploadPhoto(creator("ann"), pdf())).toEqual({ ok: false, reason: "photo", message: PHOTO_TYPE_MESSAGE });
    expect(await t.service.uploadPhoto(creator("ann"), jpeg(PHOTO_MAX_BYTES + 1))).toEqual({ ok: false, reason: "photo", message: PHOTO_SIZE_MESSAGE });
    expect(t.hosts.get("ann")!.photo).toBe("https://blob.example/old.jpg");
    expect(t.photos.put).not.toHaveBeenCalled();
    expect(t.removed).toEqual([]);
  });

  it("keeps the old photo when storing fails, and removes a new photo it could not save", async () => {
    const down = setup({ putFails: true, photo: "https://blob.example/old.jpg" });
    expect(await down.service.uploadPhoto(creator("ann"), jpeg())).toEqual({ ok: false, reason: "photo-failed" });
    expect(down.hosts.get("ann")!.photo).toBe("https://blob.example/old.jpg");
    expect(down.removed).toEqual([]);

    const dbDown = setup({ setPhotoFails: true, photo: "https://blob.example/old.jpg" });
    expect(await dbDown.service.uploadPhoto(creator("ann"), jpeg())).toEqual({ ok: false, reason: "photo-failed" });
    expect(dbDown.hosts.get("ann")!.photo).toBe("https://blob.example/old.jpg");
    expect(dbDown.removed).toEqual(dbDown.stored); // the new one is cleaned up, the old one is not touched
  });

  it("is refused for a learner and a plain owner, and says so when photos are not set up", async () => {
    const t = setup();
    expect(await t.service.uploadPhoto(learner, jpeg())).toEqual({ ok: false, reason: "not-allowed" });
    expect(await t.service.uploadPhoto(plainOwner, jpeg())).toEqual({ ok: false, reason: "not-allowed" });
    expect(t.photos.put).not.toHaveBeenCalled();
    const none = createHostService({ store: t.store, photos: null });
    expect(await none.uploadPhoto(creator("ann"), jpeg())).toEqual({ ok: false, reason: "not-set-up" });
  });
});

describe("hostFailureMessage", () => {
  it("is kind, and never mentions the storage service", () => {
    for (const reason of ["not-allowed", "not-found", "not-set-up", "photo-failed"] as const) {
      const { message } = hostFailureMessage({ ok: false, reason });
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/blob|vercel|error|invalid/i);
    }
    expect(hostFailureMessage({ ok: false, reason: "invalid", fields: { name: "Add your name in Latin letters." } })).toEqual({
      ok: false,
      message: "A few things to finish first.",
      fields: { name: "Add your name in Latin letters." },
    });
  });
});
