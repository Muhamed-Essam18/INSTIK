import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvedOnly, getHost, getHosts, getTranscript, getTranscriptView, getVideo, getVideos, getVideosByHost } from "@/lib/content";
import { getLibraryVideos, getUpNextVideos } from "@/lib/content/library";
import { contentDb } from "../helpers/content-db";

// Learners must only ever see Approved videos on every read path (constitution VIII, spec FR-023 and FR-024).
vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../helpers/content-db");
  return { db: () => contentDb.db };
});

const slug = "arabic-egyptian";
const code = "arz";
const hidden = "at-the-cafe"; // a free video that has a transcript and shares its stage with other videos
const others = ["my-family", "buying-bread-at-the-bakery"];
const statuses = ["DRAFT", "UPLOADING", "PROCESSING", "IN_REVIEW", "CHANGES_REQUESTED", "REJECTED"] as const;

beforeEach(() => contentDb.reset());

describe("the filter", () => {
  it("is exactly Approved", () => {
    expect(approvedOnly).toEqual({ status: "APPROVED", deletedAt: null });
  });
});

describe.each(statuses)("a video that is %s", (status) => {
  beforeEach(() => contentDb.setStatus(code, hidden, status));

  it("is not found, same as a video that does not exist", async () => {
    expect(await getVideo(slug, hidden)).toBeUndefined();
    expect(await getVideo(slug, hidden)).toEqual(await getVideo(slug, "no-such-video"));
  });

  it("is not in the video list, the host list of videos, the library or Up next", async () => {
    expect((await getVideos(slug)).map((v) => v.slug)).not.toContain(hidden);
    const host = contentDb.state.videos.find((v) => v.slug === hidden)!.hostId.replace(`host-${code}-`, "");
    expect((await getVideosByHost(slug, host)).map((v) => v.slug)).not.toContain(hidden);
    expect((await getLibraryVideos(slug)).map((v) => v.slug)).not.toContain(hidden);
    for (const other of others) {
      expect((await getUpNextVideos(slug, other)).map((v) => v.slug)).not.toContain(hidden);
    }
  });

  it("gives out no transcript or transcript view", async () => {
    expect(await getTranscript(slug, hidden)).toBeUndefined();
    expect(await getTranscriptView(slug, hidden)).toBeUndefined();
  });

  it("does not hide the other videos", async () => {
    expect((await getVideos(slug)).map((v) => v.slug)).toEqual(expect.arrayContaining(others));
    expect(await getVideos(slug)).toHaveLength(7);
  });
});

describe("a soft-deleted video", () => {
  beforeEach(() => contentDb.setDeletedAt(code, hidden, new Date()));

  it("is hidden everywhere even if its status were Approved, and does not hide the others", async () => {
    expect(await getVideo(slug, hidden)).toBeUndefined();
    expect((await getVideos(slug)).map((v) => v.slug)).not.toContain(hidden);
    expect((await getLibraryVideos(slug)).map((v) => v.slug)).not.toContain(hidden);
    expect(await getTranscript(slug, hidden)).toBeUndefined();
    expect((await getVideos(slug)).map((v) => v.slug)).toEqual(expect.arrayContaining(others));
  });
});

describe("a new creator video that is ready to submit", () => {
  it("never shows: a Processing video with a ready asset, and a Changes requested video with a pending file", async () => {
    contentDb.setStatus(code, hidden, "PROCESSING");
    contentDb.state.videos.find((v) => v.slug === hidden)!.assetReadyAt = new Date();
    expect(await getVideo(slug, hidden)).toBeUndefined();
    contentDb.setStatus(code, hidden, "CHANGES_REQUESTED");
    contentDb.state.videos.find((v) => v.slug === hidden)!.pendingReadyAt = new Date();
    expect(await getVideo(slug, hidden)).toBeUndefined();
  });
});

describe("a video that returns to Approved", () => {
  it("appears again everywhere", async () => {
    contentDb.setStatus(code, hidden, "IN_REVIEW");
    expect(await getVideo(slug, hidden)).toBeUndefined();
    contentDb.setStatus(code, hidden, "APPROVED");
    expect((await getVideo(slug, hidden))?.slug).toBe(hidden);
    expect((await getLibraryVideos(slug)).map((v) => v.slug)).toContain(hidden);
    expect(await getTranscript(slug, hidden)).toBeDefined();
    expect(await getTranscriptView(slug, hidden)).toBeDefined();
  });
});

describe("a language with no Approved videos", () => {
  it("gives an empty library, an empty list and no hosts with videos", async () => {
    for (const v of contentDb.state.videos) v.status = "DRAFT";
    expect(await getLibraryVideos(slug)).toEqual([]);
    expect(await getVideos(slug)).toEqual([]);
    expect(await getUpNextVideos(slug, "my-family")).toEqual([]);
    // Imported hosts still list; they just have no videos.
    expect((await getHosts(slug)).map((h) => h.slug)).toEqual(["salma", "omar"]);
    expect(await getVideosByHost(slug, "salma")).toEqual([]);
  });
});

describe("an unknown language", () => {
  it("has no content", async () => {
    expect(await getVideos("klingon")).toEqual([]);
    expect(await getVideo("klingon", "x")).toBeUndefined();
    expect(await getHosts("klingon")).toEqual([]);
    expect(await getHost("klingon", "x")).toBeUndefined();
  });
});

describe("a creator host", () => {
  it("opens by address with no videos, but is not in the hosts list until a video is Approved", async () => {
    const host = contentDb.addHost({ languageCode: code, slug: "new-creator", name: "New Creator" });
    const found = await getHost(slug, "new-creator");
    expect(found).toMatchObject({ slug: "new-creator", name: "New Creator", nameArabic: null, story: "", topics: [] });
    expect((await getHosts(slug)).map((h) => h.slug)).not.toContain("new-creator");
    expect(await getVideosByHost(slug, "new-creator")).toEqual([]);

    contentDb.addVideo({ languageCode: code, slug: "first-one", hostId: host.id, status: "IN_REVIEW" });
    expect((await getHosts(slug)).map((h) => h.slug)).not.toContain("new-creator");
    expect(await getVideosByHost(slug, "new-creator")).toEqual([]);

    contentDb.setStatus(code, "first-one", "APPROVED");
    expect((await getHosts(slug)).map((h) => h.slug)).toContain("new-creator");
    expect((await getVideosByHost(slug, "new-creator")).map((v) => v.slug)).toEqual(["first-one"]);
    expect((await getLibraryVideos(slug)).find((v) => v.slug === "first-one")?.hostName).toBe("New Creator");
  });

  it("shows only its Approved videos on its host page", async () => {
    const host = contentDb.addHost({ languageCode: code, slug: "mixed", name: "Mixed" });
    contentDb.addVideo({ languageCode: code, slug: "live-one", hostId: host.id, status: "APPROVED" });
    contentDb.addVideo({ languageCode: code, slug: "draft-one", hostId: host.id, status: "DRAFT" });
    contentDb.addVideo({ languageCode: code, slug: "review-one", hostId: host.id, status: "IN_REVIEW" });
    expect((await getVideosByHost(slug, "mixed")).map((v) => v.slug)).toEqual(["live-one"]);
  });
});
