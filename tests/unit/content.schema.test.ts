import { describe, expect, it } from "vitest";
import { glossarySchema, hostSchema, videoSchema } from "@/lib/content/schema";

const video = {
  title: "At the café",
  slug: "at-the-cafe",
  stage: "follow-it",
  topic: "food",
  host: "salma",
  durationSeconds: 520,
  access: "free",
  playbackId: "abc",
};
const host = { slug: "salma", name: "Salma", nameArabic: "سلمى", story: "Hi", topics: ["Food"], order: 1 };
const entry = { id: "w1", word: "إزَّيَّك", base: "إزاي", transliteration: "ezzayyak", english: "how are you" };

const messageOf = (r: { success: boolean; error?: { message: string } }) => r.error?.message ?? "";

describe("videoSchema", () => {
  it("accepts a valid video and optional fields", () => {
    expect(videoSchema.safeParse(video).success).toBe(true);
    expect(videoSchema.safeParse({ ...video, titleArabic: "في الكافيه", sample: true }).success).toBe(true);
  });

  it.each([
    ["title", ""],
    ["slug", "Bad Slug"],
    ["stage", "beginner"],
    ["topic", "sport"],
    ["durationSeconds", 0],
    ["durationSeconds", 1.5],
    ["access", "paid"],
    ["playbackId", ""],
  ])("rejects %s = %j", (key, value) => {
    expect(videoSchema.safeParse({ ...video, [key]: value }).success).toBe(false);
  });

  it("allows a video with no playbackId (the player shows its placeholder)", () => {
    const rest: Record<string, unknown> = { ...video };
    delete rest.playbackId;
    expect(videoSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a missing field and unknown fields", () => {
    const rest: Record<string, unknown> = { ...video };
    delete rest.title;
    expect(videoSchema.safeParse(rest).success).toBe(false);
    expect(videoSchema.safeParse({ ...video, level: "beginner" }).success).toBe(false);
  });

  it("lists allowed values for stage, topic and access", () => {
    expect(messageOf(videoSchema.safeParse({ ...video, stage: "x" }))).toContain("hear-it");
    expect(messageOf(videoSchema.safeParse({ ...video, topic: "x" }))).toContain("getting-around");
    expect(messageOf(videoSchema.safeParse({ ...video, access: "x" }))).toContain("full");
  });
});

describe("hostSchema", () => {
  it("accepts a valid host with or without a photo", () => {
    expect(hostSchema.safeParse(host).success).toBe(true);
    expect(hostSchema.safeParse({ ...host, photo: null }).success).toBe(true);
    expect(hostSchema.safeParse({ ...host, photo: "/h/salma.jpg" }).success).toBe(true);
  });

  it.each([
    ["nameArabic", undefined],
    ["topics", []],
    ["topics", ["", "x"]],
    ["topics", ["a", "b", "c", "d", "e", "f", "g"]],
    ["order", 1.2],
    ["story", ""],
  ])("rejects %s = %j", (key, value) => {
    expect(hostSchema.safeParse({ ...host, [key]: value }).success).toBe(false);
  });
});

describe("glossarySchema", () => {
  it("accepts entries with optional audio", () => {
    expect(glossarySchema.safeParse({ entries: [entry, { ...entry, id: "w2", audio: "/a.mp3" }] }).success).toBe(true);
  });

  it.each(["id", "word", "base", "transliteration", "english"])("requires %s", (key) => {
    expect(glossarySchema.safeParse({ entries: [{ ...entry, [key]: undefined }] }).success).toBe(false);
  });
});
