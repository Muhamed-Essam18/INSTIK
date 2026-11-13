import type { Actor } from "@/lib/roles/actor";
import { hasRole } from "@/lib/roles/actor";
import { checkHost, checkPhoto, type HostField, type HostInput, type HostValue } from "./host-rules";

// The creator's host page edits (spec FR-050 to FR-053). The database (`HostStore`) and the photo storage (`PhotoStore`) are passed in,
// so the rules are tested without either. Only a creator, and only their own host page, ever reaches the store.

export interface HostStore {
  /** The acting creator's own host page and its current photo, or null. */
  getOwnHost(actorId: string): Promise<{ id: string; photo: string | null } | null>;
  saveHost(hostId: string, value: HostValue): Promise<void>;
  setPhoto(hostId: string, url: string): Promise<void>;
}

export interface PhotoStore {
  put(input: { hostId: string; bytes: Uint8Array; ext: string; contentType: string }): Promise<string>;
  remove(url: string): Promise<void>;
}

export type HostFailure =
  | { ok: false; reason: "not-allowed" | "not-found" | "not-set-up" | "photo-failed" }
  | { ok: false; reason: "invalid"; fields: Partial<Record<HostField, string>> }
  | { ok: false; reason: "photo"; message: string };

export type Deps = { store: HostStore; photos: PhotoStore | null };

export function createHostService(deps: Deps) {
  const own = async (actor: Actor | null) => {
    if (!actor || !hasRole(actor, "creator")) return null;
    return deps.store.getOwnHost(actor.id);
  };

  async function saveHost(actor: Actor | null, input: HostInput): Promise<{ ok: true } | HostFailure> {
    if (!actor || !hasRole(actor, "creator")) return { ok: false, reason: "not-allowed" };
    const host = await own(actor);
    if (!host) return { ok: false, reason: "not-found" };
    const checked = checkHost(input);
    if (!checked.ok) return { ok: false, reason: "invalid", fields: checked.fields };
    await deps.store.saveHost(host.id, checked.value);
    return { ok: true };
  }

  /** Stores a new photo and only then forgets the old one, so a failure at any step leaves the old photo in place. */
  async function uploadPhoto(actor: Actor | null, bytes: Uint8Array): Promise<{ ok: true; photo: string } | HostFailure> {
    if (!actor || !hasRole(actor, "creator")) return { ok: false, reason: "not-allowed" };
    const host = await own(actor);
    if (!host) return { ok: false, reason: "not-found" };
    if (!deps.photos) return { ok: false, reason: "not-set-up" };
    const checked = checkPhoto(bytes);
    if (!checked.ok) return { ok: false, reason: "photo", message: checked.message };

    let url: string;
    try {
      url = await deps.photos.put({ hostId: host.id, bytes, ext: checked.ext, contentType: checked.contentType });
    } catch {
      return { ok: false, reason: "photo-failed" };
    }
    try {
      await deps.store.setPhoto(host.id, url);
    } catch {
      await deps.photos.remove(url).catch(() => {});
      return { ok: false, reason: "photo-failed" };
    }
    if (host.photo && host.photo !== url) await deps.photos.remove(host.photo).catch(() => console.error("[host] could not delete an old photo"));
    return { ok: true, photo: url };
  }

  return { saveHost, uploadPhoto };
}
