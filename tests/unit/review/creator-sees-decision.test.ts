import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOwnVideos, listStatusHistory } from "@/lib/content/creator-reads";
import type { Actor } from "@/lib/roles/actor";
import { contentDb } from "../../helpers/content-db";
import { owner } from "../../helpers/review-memory";
import { reviewOverContent } from "../../helpers/review-over-content";

// After the owner decides, the creator sees the new status and the note in My videos and on the video's status page, and nobody else does.
vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../../helpers/content-db");
  return { db: () => contentDb.db };
});

const code = "arz";
const as = (id: string): Actor => ({ id, email: `${id}@x.com`, name: id, role: "creator" });
const ann = as("user-ann");
const ben = as("user-ben");

let ids: { ann: string; ben: string; annOther: string };

beforeEach(() => {
  contentDb.reset();
  const annHost = contentDb.addHost({ languageCode: code, slug: "ann", name: "Ann", userId: "user-ann" });
  const benHost = contentDb.addHost({ languageCode: code, slug: "ben", name: "Ben", userId: "user-ben" });
  const mk = (slug: string, hostId: string) =>
    contentDb.addVideo({ languageCode: code, slug, hostId, status: "IN_REVIEW", proposedStage: "hear-it", stage: null, topic: "food", durationSeconds: 120, playbackId: "pb", title: slug });
  const a = mk("ann-one", annHost.id);
  const a2 = mk("ann-two", annHost.id);
  const b = mk("ben-one", benHost.id);
  for (const v of [a, a2, b]) contentDb.state.segments.push({ videoId: v.id, position: 1, start: 0, end: 2, script: "مرحبا", transliteration: null, english: null });
  ids = { ann: a.id, annOther: a2.id, ben: b.id };
});

describe("a decision as the creator sees it", () => {
  it("shows Changes requested and the note in My videos and in the history, for that creator only", async () => {
    const note = "Please re-record the audio; the street noise is too loud.";
    expect((await reviewOverContent().decide(owner, { videoId: ids.ann, decision: "changes", note })).ok).toBe(true);

    const mine = (await listOwnVideos(ann)).find((v) => v.id === ids.ann)!;
    expect(mine.status).toBe("CHANGES_REQUESTED");
    expect(mine.latestNote).toBe(note);
    const history = await listStatusHistory(ann, ids.ann);
    expect(history!.at(-1)).toMatchObject({ toStatus: "CHANGES_REQUESTED", note, actorLabel: "Boss", byYou: false });

    // Another creator learns nothing about it, and the creator's other video is untouched.
    expect(await listStatusHistory(ben, ids.ann)).toBeNull();
    expect((await listOwnVideos(ben)).some((v) => v.id === ids.ann)).toBe(false);
    expect((await listOwnVideos(ann)).find((v) => v.id === ids.annOther)!.status).toBe("IN_REVIEW");
  });

  it("shows Rejected with its note, and Live after an approval (which has no note)", async () => {
    await reviewOverContent().decide(owner, { videoId: ids.ann, decision: "reject", note: "This isn't a fit for Instik." });
    expect((await listOwnVideos(ann)).find((v) => v.id === ids.ann)).toMatchObject({ status: "REJECTED", latestNote: "This isn't a fit for Instik." });

    await reviewOverContent().decide(owner, { videoId: ids.annOther, decision: "approve" });
    const live = (await listOwnVideos(ann)).find((v) => v.id === ids.annOther)!;
    expect(live.status).toBe("APPROVED");
    expect(live.latestNote).toBeNull();
    expect(live.stage).toBe("hear-it");
  });
});
