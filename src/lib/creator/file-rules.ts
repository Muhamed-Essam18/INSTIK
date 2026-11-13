import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from "./limits";

// The browser-side check of a chosen file, before any upload starts (spec FR-010, FR-018). Pure. The video host checks the real
// file again and reports a problem through its notice; this only spares the creator a long upload that cannot work.

export type FileCheck = { ok: true } | { ok: false; reason: "type" | "size"; message: string };

export const FILE_TYPE_MESSAGE = "Please choose an MP4 or MOV video.";
export const FILE_SIZE_MESSAGE = "That file is over 4 GB. Please choose a smaller one, for example by exporting at a lower quality.";

export function checkFile(file: { name: string; size: number; type: string }): FileCheck {
  const name = file.name.toLowerCase();
  const extensionOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  // Some systems give no type for a .mov; the extension then decides. A type that is given must be a video type we accept.
  const typeOk = file.type === "" || (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!extensionOk || !typeOk) return { ok: false, reason: "type", message: FILE_TYPE_MESSAGE };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "size", message: FILE_SIZE_MESSAGE };
  return { ok: true };
}

/** "1.2 GB" or "340 MB", for showing the chosen file. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}
