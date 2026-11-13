import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOwnPlayback,
  getOwnProfile,
  getOwnVideo,
  listAllVideos,
  listOwnVideos,
  listStatusHistory,
} from "@/lib/content/creator-reads";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import { contentDb } from "../helpers/content-db";

// A creator never sees another creator's data (constitution XI, spec FR-028 and FR-029). Two creators, each with videos in
// several statuses and a history; the reads run against the stand-in tables, whose query matching mirrors the real filters.

vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../helpers/content-db");
  return { db: () => contentDb.db };
});

const code = "arz";
const actor = (id: string, role: Actor["role"]): Actor => ({ id, email: `${id}@x.com`, name: id, role });
const creatorA = actor("user-ann", "creator");
const creatorB = actor("user-ben", "creator");
const owner = actor("boss", "owner");
const learner = actor("learn", "learner");

let ids: { a: string[]; b: string[] };

beforeEach(() => {
  contentDb.reset();
  const ann = contentDb.addHost({ languageCode: code, slug: "ann", name: "Ann", userId: "user-ann", story: "Ann's story", topics: ["Food"] });
  const ben = contentDb.addHost({ languageCode: code, slug: "ben", name: "Ben", userId: "user-ben", story: "Ben's story", topics: ["Football"] });
  const mk = (slug: string, hostId: string, status: string) => contentDb.addVideo({ languageCode: code, slug, hostId, status });
  const a = [mk("ann-draft", ann.id, "DRAFT"), mk("ann-review", ann.id, "IN_REVIEW"), mk("ann-live", ann.id, "APPROVED")];
  const b = [mk("ben-draft", ben.id, "DRAFT"), mk("ben-changes", ben.id, "CHANGES_REQUESTED"), mk("ben-live", ben.id, "APPROVED")];
  for (const v of [...a, ...b]) {
    contentDb.addEvent({ videoId: v.id, toStatus: "DRAFT", actorLabel: v.hostId === ann.id ? "Ann" : "Ben", note: `secret note on ${v.slug}` });
  }
  ids = { a: a.map((v) => v.id), b: b.map((v) => v.id) };
});

const slugs = (videos: { slug: string }[]) => videos.map((v) => v.slug).sort();

describe("a creator", () => {
  it("lists only their own videos, in every status", async () => {
    expect(slugs(await listOwnVideos(creatorA))).toEqual(["ann-draft", "ann-live", "ann-review"]);
    expect(slugs(await listOwnVideos(creatorB))).toEqual(["ben-changes", "ben-draft", "ben-live"]);
  });

  it("does not see the imported sample videos either", async () => {
    expect((await listOwnVideos(creatorA)).some((v) => v.slug === "my-family")).toBe(false);
  });

  it("gets another creator's video exactly as if it did not exist", async () => {
    expect(await getOwnVideo(creatorA, ids.b[0])).toBeNull();
    expect(await getOwnVideo(creatorA, "no-such-id")).toBeNull();
    expect((await getOwnVideo(creatorA, ids.a[0]))?.slug).toBe("ann-draft");
  });

  it("reads the history of their own video but gets nothing for another creator's", async () => {
    const own = await listStatusHistory(creatorA, ids.a[0]);
    expect(own?.map((e) => e.note)).toEqual(["secret note on ann-draft"]);
    expect(await listStatusHistory(creatorA, ids.b[0])).toBeNull();
    expect(await listStatusHistory(creatorA, "no-such-id")).toBeNull();
  });

  it("never leaks another creator's note anywhere in what they can read", async () => {
    const everything = JSON.stringify([
      await listOwnVideos(creatorA),
      ...(await Promise.all(ids.a.map((id) => listStatusHistory(creatorA, id)))),
      await getOwnProfile(creatorA),
    ]);
    expect(everything).not.toContain("ben");
    expect(everything).not.toContain("Ben");
  });

  it("gets a video with no history as an empty history, not as a missing video", async () => {
    const host = contentDb.state.hosts.find((h) => h.slug === "ann")!;
    const bare = contentDb.addVideo({ languageCode: code, slug: "ann-bare", hostId: host.id, status: "DRAFT" });
    expect(await listStatusHistory(creatorA, bare.id)).toEqual([]);
    expect(await listStatusHistory(creatorB, bare.id)).toBeNull();
  });

  it("reads their own profile and no one else's", async () => {
    expect(await getOwnProfile(creatorA)).toMatchObject({ slug: "ann", name: "Ann" });
    expect(await getOwnProfile(creatorB)).toMatchObject({ slug: "ben", name: "Ben" });
  });

  it("is refused the owner-only list", async () => {
    await expect(listAllVideos(creatorA)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("an owner", () => {
  it("sees every video, every history and any video by id", async () => {
    expect(slugs(await listAllVideos(owner))).toEqual(expect.arrayContaining(["ann-draft", "ben-draft", "my-family"]));
    expect((await listAllVideos(owner)).length).toBe(8 + 6);
    expect((await getOwnVideo(owner, ids.b[0]))?.slug).toBe("ben-draft");
    expect((await listStatusHistory(owner, ids.b[0]))?.length).toBe(1);
  });

  it("has no creator profile of their own", async () => {
    expect(await getOwnProfile(owner)).toBeNull();
  });
});

describe("a learner", () => {
  it("is refused every function and gets no data", async () => {
    await expect(listOwnVideos(learner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getOwnVideo(learner, ids.a[0])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listStatusHistory(learner, ids.a[0])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAllVideos(learner)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getOwnProfile(learner)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("the functions cannot be widened", () => {
  it("take only the acting user and an id of the thing asked for, never a user id or a status", () => {
    expect(listOwnVideos.length).toBe(1);
    expect(getOwnVideo.length).toBe(2);
    expect(listStatusHistory.length).toBe(2);
    expect(listAllVideos.length).toBe(1);
    expect(getOwnProfile.length).toBe(1);
  });
});

describe("creator upload reads (spec 9)", () => {
  const video = (slug: string) => contentDb.state.videos.find((v) => v.slug === slug)!;

  it("leaves a soft-deleted video out of the list, the single read and the history, for its creator and for an owner", async () => {
    video("ann-draft").deletedAt = new Date();
    expect(slugs(await listOwnVideos(creatorA))).toEqual(["ann-live", "ann-review"]);
    expect(await getOwnVideo(creatorA, ids.a[0])).toBeNull();
    expect(await listStatusHistory(creatorA, ids.a[0])).toBeNull();
    expect(slugs(await listAllVideos(owner))).not.toContain("ann-draft");
    expect(await getOwnVideo(owner, ids.a[0])).toBeNull();
  });

  it("gives each video the note of its newest history entry, and none when that entry has no note", async () => {
    const [draft, review] = [video("ann-draft"), video("ann-review")];
    contentDb.addEvent({ videoId: draft.id, toStatus: "CHANGES_REQUESTED", note: "Please re-record the intro", createdAt: new Date(2026, 10, 5) });
    contentDb.addEvent({ videoId: review.id, toStatus: "CHANGES_REQUESTED", note: "An old note", createdAt: new Date(2026, 10, 5) });
    contentDb.addEvent({ videoId: review.id, toStatus: "IN_REVIEW", note: null, createdAt: new Date(2026, 10, 6) });
    const notes = Object.fromEntries((await listOwnVideos(creatorA)).map((v) => [v.slug, v.latestNote]));
    expect(notes["ann-draft"]).toBe("Please re-record the intro");
    expect(notes["ann-review"]).toBeNull();
  });

  it("lists the most recently updated video first", async () => {
    video("ann-draft").updatedAt = new Date(2026, 10, 3);
    video("ann-review").updatedAt = new Date(2026, 10, 9);
    video("ann-live").updatedAt = new Date(2026, 10, 6);
    expect((await listOwnVideos(creatorA)).map((v) => v.slug)).toEqual(["ann-review", "ann-live", "ann-draft"]);
  });

  it("never hands the browser a Mux id: only whether a file exists", async () => {
    const v = video("ann-draft");
    v.muxAssetId = "asset-zzmux";
    v.muxUploadId = "upload-zzmux";
    v.pendingUploadId = "pending-upload-zzmux";
    v.pendingAssetId = "pending-asset-zzmux";
    v.playbackId = "playback-zzmux";
    const read = await getOwnVideo(creatorA, ids.a[0]);
    expect(read).toMatchObject({ hasAsset: true, hasPlayback: true, hasPendingUpload: true, hasPendingAsset: true });
    const text = JSON.stringify([read, await listOwnVideos(creatorA)]);
    expect(text).not.toContain("zzmux");
  });

  it("reports whether the host page is complete: a photo, both names and a story", async () => {
    expect((await getOwnProfile(creatorA))?.complete).toBe(false);
    const host = contentDb.state.hosts.find((h) => h.slug === "ann")!;
    Object.assign(host, { photo: "https://blob.example/ann.jpg", nameArabic: "آن", story: "A story" });
    expect((await getOwnProfile(creatorA))?.complete).toBe(true);
    host.photo = null;
    expect((await getOwnProfile(creatorA))?.complete).toBe(false);
  });

  it("keeps refusing a learner and another creator after the new fields", async () => {
    await expect(getOwnVideo(learner, ids.a[0])).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getOwnVideo(creatorB, ids.a[0])).toBeNull();
  });
});

describe("the history and the preview (spec 9)", () => {
  it("marks the changes the asking creator made themselves as theirs, without handing out an id", async () => {
    const [draft] = contentDb.state.videos.filter((v) => v.slug === "ann-draft");
    contentDb.addEvent({ videoId: draft.id, fromStatus: "DRAFT", toStatus: "UPLOADING", actorId: "user-ann", actorLabel: "Ann", createdAt: new Date(2026, 10, 2) });
    contentDb.addEvent({ videoId: draft.id, fromStatus: "UPLOADING", toStatus: "PROCESSING", actorId: null, actorLabel: "Instik", createdAt: new Date(2026, 10, 3) });
    const history = (await listStatusHistory(creatorA, ids.a[0]))!;
    expect(history.map((e) => [e.toStatus, e.byYou])).toEqual([["DRAFT", false], ["UPLOADING", true], ["PROCESSING", false]]);
    expect(JSON.stringify(history)).not.toContain("user-ann");
  });

  it("gives a creator the playback id of their own video only", async () => {
    const own = contentDb.state.videos.find((v) => v.slug === "ann-draft")!;
    expect(await getOwnPlayback(creatorA, ids.a[0])).toBeNull();
    own.playbackId = "pb-ann";
    expect(await getOwnPlayback(creatorA, ids.a[0])).toEqual({ playbackId: "pb-ann", access: "FREE", durationSeconds: 300 });
    expect(await getOwnPlayback(creatorB, ids.a[0])).toBeNull();
    own.deletedAt = new Date();
    expect(await getOwnPlayback(creatorA, ids.a[0])).toBeNull();
    await expect(getOwnPlayback(learner, ids.a[0])).rejects.toBeInstanceOf(ForbiddenError);
  });
});
