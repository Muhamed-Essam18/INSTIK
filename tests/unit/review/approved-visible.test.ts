import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHost, getTranscript, getTranscriptView, getVideo, getVideos, getVideosByHost } from "@/lib/content";
import { getLibraryVideos, getUpNextVideos } from "@/lib/content/library";
import { filterVideos } from "@/lib/content/search";
import { contentDb } from "../../helpers/content-db";
import { reviewOverContent as service } from "../../helpers/review-over-content";
import { owner } from "../../helpers/review-memory";

// A video the owner approves is visible to learners at once (spec 10 SC-004), and one that is rejected or sent back never is.
// The review service runs here against the same in-memory content tables the learner reads use, so nothing is faked between them.
vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../../helpers/content-db");
  return { db: () => contentDb.db };
});

const slug = "arabic-egyptian";
const code = "arz";

function newVideo(status = "IN_REVIEW") {
  const host = contentDb.addHost({ languageCode: code, slug: "new-creator", name: "New Creator" });
  const video = contentDb.addVideo({
    languageCode: code,
    slug: "rainy-day",
    hostId: host.id,
    status,
    title: "A rainy day in Alexandria",
    proposedStage: "hear-it",
    stage: null,
    topic: "daily-life",
    durationSeconds: 300,
    playbackId: "pb-1",
    access: "FULL",
  });
  contentDb.state.segments.push({ videoId: video.id, position: 1, start: 0, end: 4, script: "الدُّنْيا بِتْمَطَّر", transliteration: "id-donya", english: "It rains" });
  return video;
}

beforeEach(() => contentDb.reset());

describe("an approved video is visible at once", () => {
  it("is in the video list, its own page, search, the host page, Up next and has its transcript, straight after decide resolves", async () => {
    const video = newVideo();
    expect(await getVideo(slug, "rainy-day")).toBeUndefined();

    const started = Date.now();
    const result = await service().decide(owner, { videoId: video.id, decision: "approve" });
    expect(result.ok).toBe(true);

    // Read straight away: no waiting, no cache to clear.
    expect((await getVideo(slug, "rainy-day"))?.title).toBe("A rainy day in Alexandria");
    expect((await getVideos(slug)).map((v) => v.slug)).toContain("rainy-day");
    const library = await getLibraryVideos(slug);
    expect(filterVideos(library, { stage: "hear-it", topic: null, query: "rainy" }).map((v) => v.slug)).toContain("rainy-day");
    expect((await getVideosByHost(slug, "new-creator")).map((v) => v.slug)).toEqual(["rainy-day"]);
    expect(await getHost(slug, "new-creator")).toBeDefined();
    const reference = contentDb.state.videos.find((v) => v.id !== video.id && v.stage === "hear-it" && v.status === "APPROVED")!;
    expect((await getUpNextVideos(slug, reference.slug)).map((v) => v.slug)).toContain("rainy-day");
    expect(await getTranscript(slug, "rainy-day")).toBeDefined();
    expect((await getTranscriptView(slug, "rainy-day"))?.lines).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(5000);
    // The final stage is what was proposed, and it was recorded with the owner.
    expect(contentDb.state.videos.find((v) => v.id === video.id)).toMatchObject({ status: "APPROVED", stage: "hear-it" });
    expect(contentDb.state.events.at(-1)).toMatchObject({ toStatus: "APPROVED", actorId: "boss" });
  });

  it.each([
    ["reject", "REJECTED"],
    ["changes", "CHANGES_REQUESTED"],
  ] as const)("a video that is %s appears nowhere", async (decision, status) => {
    const video = newVideo();
    const result = await service().decide(owner, { videoId: video.id, decision, note: "Not this time." });
    expect(result.ok).toBe(true);
    expect(contentDb.state.videos.find((v) => v.id === video.id)!.status).toBe(status);
    expect(await getVideo(slug, "rainy-day")).toBeUndefined();
    expect((await getVideos(slug)).map((v) => v.slug)).not.toContain("rainy-day");
    expect((await getLibraryVideos(slug)).map((v) => v.slug)).not.toContain("rainy-day");
    expect(await getVideosByHost(slug, "new-creator")).toEqual([]);
    expect(await getTranscript(slug, "rainy-day")).toBeUndefined();
  });

  it("a refused approval leaves the video hidden", async () => {
    const video = newVideo();
    contentDb.state.segments = contentDb.state.segments.filter((s) => s.videoId !== video.id);
    const result = await service().decide(owner, { videoId: video.id, decision: "approve" });
    expect(result).toMatchObject({ ok: false, reason: "no-transcript" });
    expect(await getVideo(slug, "rainy-day")).toBeUndefined();
  });
});
