// What a creator may put on their host page (spec FR-050 to FR-053). Pure: no database, no storage.

export const NAME_MAX = 80;
export const STORY_MAX = 600;
export const TOPICS_MAX = 6;
export const TOPIC_MAX = 30;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type HostInput = { name?: unknown; nameArabic?: unknown; story?: unknown; topics?: unknown };
export type HostValue = { name: string; nameArabic: string; story: string; topics: string[] };
export type HostField = "name" | "nameArabic" | "story" | "topics";

export type HostCheck = { ok: true; value: HostValue } | { ok: false; fields: Partial<Record<HostField, string>> };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Checks the host form. Names are kept exactly as typed (the Arabic name with its vowel marks) apart from trimming the ends; topics are
 * short free-text tags like those on the sample hosts, trimmed, without blanks and without repeats.
 */
export function checkHost(input: HostInput): HostCheck {
  const fields: Partial<Record<HostField, string>> = {};
  const name = text(input.name);
  const nameArabic = text(input.nameArabic);
  const story = text(input.story);

  if (!name) fields.name = "Add your name in Latin letters.";
  else if (name.length > NAME_MAX) fields.name = `Keep your name to ${NAME_MAX} characters.`;
  if (!nameArabic) fields.nameArabic = "Add your name in Arabic.";
  else if (nameArabic.length > NAME_MAX) fields.nameArabic = `Keep your name to ${NAME_MAX} characters.`;
  if (!story) fields.story = "Write a few words about yourself.";
  else if (story.length > STORY_MAX) fields.story = `Keep your story to ${STORY_MAX} characters.`;

  const raw = Array.isArray(input.topics) ? input.topics.map(text).filter(Boolean) : [];
  const topics = raw.filter((topic, index) => raw.findIndex((other) => other.toLowerCase() === topic.toLowerCase()) === index);
  if (topics.length > TOPICS_MAX) fields.topics = `Choose up to ${TOPICS_MAX} topics.`;
  else if (topics.some((topic) => topic.length > TOPIC_MAX)) fields.topics = `Keep each topic to ${TOPIC_MAX} characters.`;

  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, value: { name, nameArabic, story, topics } };
}

// ---- The photo -------------------------------------------------------------------------------------------------------------

export type ImageKind = { ext: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp" };

/** What the file really is, from its first bytes: the type the browser declared is never trusted. Null for anything else. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const is = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (bytes.length >= 3 && is(0, 0xff, 0xd8, 0xff)) return { ext: "jpg", contentType: "image/jpeg" };
  if (bytes.length >= 8 && is(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: "png", contentType: "image/png" };
  if (bytes.length >= 12 && is(0, 0x52, 0x49, 0x46, 0x46) && is(8, 0x57, 0x45, 0x42, 0x50)) return { ext: "webp", contentType: "image/webp" };
  return null;
}

export const PHOTO_TYPE_MESSAGE = "Please choose a JPEG, PNG or WebP photo.";
export const PHOTO_SIZE_MESSAGE = "That photo is over 2 MB. Please choose a smaller one.";

export type PhotoCheck = ({ ok: true } & ImageKind) | { ok: false; reason: "type" | "size" | "empty"; message: string };

/** The size comes first (a cheap check before reading bytes), then what the file really is. */
export function checkPhoto(bytes: Uint8Array): PhotoCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty", message: PHOTO_TYPE_MESSAGE };
  if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, reason: "size", message: PHOTO_SIZE_MESSAGE };
  const kind = sniffImage(bytes);
  return kind ? { ok: true, ...kind } : { ok: false, reason: "type", message: PHOTO_TYPE_MESSAGE };
}
