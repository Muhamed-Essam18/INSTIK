import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraryProgress } from "@/lib/hours/queries";
import { saveAnswer } from "@/lib/learner/preferences";
import { contentDb } from "../helpers/content-db";

// FR-025 and SC-010: what a learner already saved is keyed by language code and video slug, and the imported videos keep
// exactly those slugs, so progress, answers and pick-up resolve to them. Progress for a video that is not Approved shows nowhere.

const mocks = vi.hoisted(() => ({ progress: vi.fn(), profile: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../helpers/content-db");
  return {
    db: () => ({
      ...contentDb.db,
      videoProgress: { findMany: mocks.progress },
      learnerLanguage: { findUnique: mocks.profile },
      comprehensionAnswer: { upsert: mocks.upsert },
    }),
  };
});

const code = "arz";
const now = new Date();
const row = (videoSlug: string, extra: object = {}) => ({ videoSlug, positionSeconds: 0, watched: false, updatedAt: now, ...extra });

beforeEach(() => {
  contentDb.reset();
  mocks.progress.mockReset().mockResolvedValue([]);
  mocks.profile.mockReset().mockResolvedValue({ id: "p1" });
  mocks.upsert.mockReset().mockResolvedValue(undefined);
});

describe("the sample videos keep the slugs of their files", () => {
  it("has exactly the eight sample slugs", () => {
    const slugs = contentDb.state.videos.filter((v) => v.languageCode === code).map((v) => v.slug).sort();
    expect(slugs).toEqual(
      [
        "a-day-at-a-wedding",
        "a-walk-on-the-corniche",
        "at-the-cafe",
        "buying-bread-at-the-bakery",
        "colours-at-the-market",
        "my-family",
        "ramadan-nights",
        "taking-a-microbus",
      ].sort(),
    );
  });
});

describe("saved progress still resolves", () => {
  it("picks up an unfinished sample video and marks a watched one", async () => {
    mocks.progress.mockResolvedValue([
      row("at-the-cafe", { positionSeconds: 134 }),
      row("my-family", { watched: true, positionSeconds: 300 }),
    ]);
    const result = await getLibraryProgress("u1", code);
    expect(result.pickUp).toEqual({ videoSlug: "at-the-cafe", positionSeconds: 134 });
    expect(result.watchedSlugs).toEqual(["my-family"]);
  });

  it("shows nothing for a video that is not Approved, and again once it is", async () => {
    mocks.progress.mockResolvedValue([row("at-the-cafe", { positionSeconds: 90 }), row("my-family", { watched: true })]);
    contentDb.setStatus(code, "at-the-cafe", "IN_REVIEW");
    contentDb.setStatus(code, "my-family", "REJECTED");
    expect(await getLibraryProgress("u1", code)).toEqual({ pickUp: null, watchedSlugs: [] });
    contentDb.setStatus(code, "at-the-cafe", "APPROVED");
    contentDb.setStatus(code, "my-family", "APPROVED");
    const back = await getLibraryProgress("u1", code);
    expect(back.pickUp?.videoSlug).toBe("at-the-cafe");
    expect(back.watchedSlugs).toEqual(["my-family"]);
  });
});

describe("saved answers still resolve", () => {
  it("saves an answer for an Approved sample video", async () => {
    expect(await saveAnswer("u1", code, "my-family", "mostly")).toBe("ok");
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("refuses an answer for a video that is not Approved, as for one that does not exist", async () => {
    contentDb.setStatus(code, "my-family", "DRAFT");
    expect(await saveAnswer("u1", code, "my-family", "mostly")).toBe("unknown-video");
    expect(await saveAnswer("u1", code, "no-such-video", "mostly")).toBe("unknown-video");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
