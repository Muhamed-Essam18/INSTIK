import "server-only";
import { del, put } from "@vercel/blob";
import { env } from "@/lib/env";
import { randomUUID } from "node:crypto";
import type { PhotoStore } from "./host-service";

// Host photos live in a public Vercel Blob store (research R5): small, public by nature (they are on the public host page), and kept
// under host-photos/<host id>/. The store's token is optional; without it photo upload says it is not set up and the rest still works.

export const photosEnabled = (): boolean => Boolean(env().BLOB_READ_WRITE_TOKEN);

export function blobPhotoStore(): PhotoStore | null {
  const token = env().BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return {
    async put({ hostId, bytes, ext, contentType }) {
      // A random name (not the file's own) so nothing the creator typed is in the address, and a new photo never replaces the old one in place.
      const blob = await put(`host-photos/${hostId}/${randomUUID()}.${ext}`, Buffer.from(bytes), {
        access: "public",
        contentType,
        token,
        addRandomSuffix: false,
      });
      return blob.url;
    },
    async remove(url) {
      await del(url, { token });
    },
  };
}
