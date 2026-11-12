import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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
