import { describe, expect, it } from "vitest";
import {
  PHOTO_MAX_BYTES,
  PHOTO_SIZE_MESSAGE,
  PHOTO_TYPE_MESSAGE,
  checkHost,
  checkPhoto,
  sniffImage,
} from "@/lib/creator/host-rules";

const good = { name: "Salma", nameArabic: "سَلمى", story: "I grew up in Alexandria.", topics: ["Food", "Family"] };
const bytes = (head: number[], length = head.length) => Uint8Array.from({ length }, (_, i) => head[i] ?? 0);
const jpeg = (length = 100) => bytes([0xff, 0xd8, 0xff, 0xe0], length);
const png = (length = 100) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], length);
const webp = (length = 100) => bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], length);

describe("checkHost", () => {
  it("accepts a complete page and keeps the Arabic name exactly as typed, vowel marks included", () => {
    const result = checkHost(good);
    expect(result).toEqual({ ok: true, value: good });
    expect(result.ok && result.value.nameArabic).toBe("سَلمى");
  });

  it("trims the ends and nothing else", () => {
    const result = checkHost({ ...good, name: "  Salma  ", story: "  Hello there.  " });
    expect(result.ok && result.value).toMatchObject({ name: "Salma", story: "Hello there." });
  });

  it("limits the Latin name to 80, the Arabic name to 80 and the story to 600 characters", () => {
    expect(checkHost({ ...good, name: "x".repeat(81) })).toMatchObject({ ok: false, fields: { name: expect.any(String) } });
    expect(checkHost({ ...good, name: "x".repeat(80) }).ok).toBe(true);
    expect(checkHost({ ...good, nameArabic: "س".repeat(81) })).toMatchObject({ ok: false, fields: { nameArabic: expect.any(String) } });
    expect(checkHost({ ...good, nameArabic: "س".repeat(80) }).ok).toBe(true);
    expect(checkHost({ ...good, story: "x".repeat(601) })).toMatchObject({ ok: false, fields: { story: expect.any(String) } });
    expect(checkHost({ ...good, story: "x".repeat(600) }).ok).toBe(true);
  });

  it("needs both names and a story, and says which is missing in kind words", () => {
    const result = checkHost({ name: "  ", nameArabic: "", story: "", topics: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fields).sort()).toEqual(["name", "nameArabic", "story"]);
    for (const message of Object.values(result.fields)) expect(message).not.toMatch(/invalid|error|must|required/i);
  });

  it("takes 0 to 6 short topics, drops blanks and repeats, and refuses more than 6 or a long one", () => {
    expect(checkHost({ ...good, topics: [] }).ok).toBe(true);
    expect(checkHost({ ...good, topics: ["a", "b", "c", "d", "e", "f"] }).ok).toBe(true);
    expect(checkHost({ ...good, topics: ["a", "b", "c", "d", "e", "f", "g"] })).toMatchObject({ ok: false, fields: { topics: expect.any(String) } });
    expect(checkHost({ ...good, topics: ["x".repeat(31)] })).toMatchObject({ ok: false, fields: { topics: expect.any(String) } });
    const tidy = checkHost({ ...good, topics: ["Food", "  food ", "", "Family"] });
    expect(tidy.ok && tidy.value.topics).toEqual(["Food", "Family"]);
    const many = checkHost({ ...good, topics: ["a", "A", "b", "c", "d", "e", "f"] });
    expect(many.ok).toBe(true); // a repeat does not count toward the limit
  });

  it("treats input of the wrong type as missing, never as text", () => {
    expect(checkHost({ name: 42, nameArabic: {}, story: null, topics: "Food" }).ok).toBe(false);
    const result = checkHost({ ...good, topics: "Food" });
    expect(result.ok && result.value.topics).toEqual([]);
  });
});

describe("sniffImage: what a file really is, from its first bytes", () => {
  it("knows JPEG, PNG and WebP", () => {
    expect(sniffImage(jpeg())).toEqual({ ext: "jpg", contentType: "image/jpeg" });
    expect(sniffImage(png())).toEqual({ ext: "png", contentType: "image/png" });
    expect(sniffImage(webp())).toEqual({ ext: "webp", contentType: "image/webp" });
  });

  it("refuses everything else, however it is named", () => {
    expect(sniffImage(bytes([0x25, 0x50, 0x44, 0x46], 100))).toBeNull(); // a PDF
    expect(sniffImage(bytes([0x47, 0x49, 0x46, 0x38], 100))).toBeNull(); // a GIF
    expect(sniffImage(bytes([0x3c, 0x73, 0x76, 0x67], 100))).toBeNull(); // SVG text
    expect(sniffImage(bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45], 100))).toBeNull(); // a WAV, also RIFF
    expect(sniffImage(Uint8Array.from([0xff, 0xd8]))).toBeNull(); // too short to be one
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("checkPhoto", () => {
  it("accepts a real photo of up to exactly 2 MB and refuses one byte more", () => {
    expect(PHOTO_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(checkPhoto(jpeg(PHOTO_MAX_BYTES))).toEqual({ ok: true, ext: "jpg", contentType: "image/jpeg" });
    expect(checkPhoto(jpeg(PHOTO_MAX_BYTES + 1))).toEqual({ ok: false, reason: "size", message: PHOTO_SIZE_MESSAGE });
  });

  it("refuses a file that is not an image even when it is small, with the plain message", () => {
    expect(checkPhoto(bytes([0x25, 0x50, 0x44, 0x46], 50))).toEqual({ ok: false, reason: "type", message: PHOTO_TYPE_MESSAGE });
    expect(checkPhoto(new Uint8Array())).toMatchObject({ ok: false, reason: "empty" });
  });
});
