import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { creatorActor, learnerActor, owner, segment, setupReview, video, ids } from "../../helpers/review-memory";

const at = (iso: string) => new Date(iso);

describe("getQueue", () => {
  it("lists videos in review oldest submission first, by the newest IN_REVIEW history entry", async () => {
    const t = setupReview({ videos: [video({ id: "a" }), video({ id: "b" }), video({ id: "c" })] });
    t.state.events.push(
      t.ev({ videoId: "a", toStatus: "IN_REVIEW", createdAt: at("2026-11-10T10:00:00Z") }),
      // b was submitted early, sent back, and submitted again later: the later date counts.
      t.ev({ videoId: "b", toStatus: "IN_REVIEW", createdAt: at("2026-11-01T10:00:00Z") }),
      t.ev({ videoId: "b", toStatus: "IN_REVIEW", createdAt: at("2026-11-12T10:00:00Z") }),
      t.ev({ videoId: "c", toStatus: "IN_REVIEW", createdAt: at("2026-11-05T10:00:00Z") }),
    );
    const q = await t.service.getQueue(owner, { list: "review" });
    expect(ids(q.rows)).toEqual(["c", "a", "b"]);
    expect(q.rows.find((r) => r.id === "c")!.waiting).toBe("8 days");
    expect(q.rows.find((r) => r.id === "b")!.waiting).toBe("1 day");
  });

  it("badges by segment count and counts each kind", async () => {
    const t = setupReview({
      videos: [video({ id: "a" }), video({ id: "b" }), video({ id: "c", status: "CHANGES_REQUESTED" }), video({ id: "d", status: "REJECTED" })],
      segments: { b: [segment({ id: "s1", start: 0, end: 2 })] },
    });
    const q = await t.service.getQueue(owner, { list: "review" });
    expect(q.rows.find((r) => r.id === "a")).toMatchObject({ badge: "Needs review", hasTranscript: false });
    expect(q.rows.find((r) => r.id === "b")).toMatchObject({ badge: "Transcript in progress", hasTranscript: true });
    expect(q.counts).toMatchObject({ needsReview: 1, transcriptInProgress: 1, waitingOnCreator: 1, approvedThisMonth: 0 });
  });

  it("lists Changes requested videos oldest first for the waiting list", async () => {
    const t = setupReview({ videos: [video({ id: "a", status: "CHANGES_REQUESTED" }), video({ id: "b", status: "CHANGES_REQUESTED" }), video({ id: "c" })] });
    t.state.events.push(
      t.ev({ videoId: "a", toStatus: "CHANGES_REQUESTED", createdAt: at("2026-11-11T10:00:00Z") }),
      t.ev({ videoId: "b", toStatus: "CHANGES_REQUESTED", createdAt: at("2026-11-02T10:00:00Z") }),
      t.ev({ videoId: "b", toStatus: "CHANGES_REQUESTED", createdAt: at("2026-11-06T10:00:00Z") }),
    );
    const q = await t.service.getQueue(owner, { list: "waiting" });
    expect(ids(q.rows)).toEqual(["b", "a"]);
    expect(q.rows[0].badge).toBe("Changes requested");
  });

  it("excludes soft-deleted videos from rows and counts", async () => {
    const t = setupReview({ videos: [video({ id: "a", deleted: true }), video({ id: "b", status: "CHANGES_REQUESTED", deleted: true }), video({ id: "c" })] });
    const q = await t.service.getQueue(owner, { list: "review" });
    expect(ids(q.rows)).toEqual(["c"]);
    expect(q.counts.waitingOnCreator).toBe(0);
  });

  it("counts approvals since the start of the month in Warsaw time, with winter and summer boundaries", async () => {
    const approve = (t: ReturnType<typeof setupReview>, iso: string) => t.state.events.push(t.ev({ videoId: "a", toStatus: "APPROVED", createdAt: at(iso) }));

    // 23:30 UTC on 31 January is already 1 February in Warsaw: it counts for February.
    const feb = setupReview({ videos: [video({ id: "a", status: "APPROVED" })] }, { clock: { now: at("2026-02-10T12:00:00Z") } });
    approve(feb, "2026-01-31T23:30:00Z");
    approve(feb, "2026-01-31T22:30:00Z");
    expect((await feb.service.getQueue(owner, { list: "review" })).counts.approvedThisMonth).toBe(1);

    // 22:30 UTC on 31 July is already 1 August in Warsaw (summer time): it counts for August.
    const aug = setupReview({ videos: [video({ id: "a", status: "APPROVED" })] }, { clock: { now: at("2026-08-10T12:00:00Z") } });
    approve(aug, "2026-07-31T22:30:00Z");
    approve(aug, "2026-07-31T21:30:00Z");
    expect((await aug.service.getQueue(owner, { list: "review" })).counts.approvedThisMonth).toBe(1);
  });

  it("refuses a creator, a learner and nobody", async () => {
    const t = setupReview({ videos: [video({ id: "a" })] });
    for (const actor of [creatorActor, learnerActor, null]) {
      await expect(t.service.getQueue(actor, { list: "review" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(t.service.getQueue(actor, { list: "waiting" })).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("shows the final stage when set, else the proposal", async () => {
    const t = setupReview({ videos: [video({ id: "a", stage: "follow-it", proposedStage: "hear-it" }), video({ id: "b" })] });
    const q = await t.service.getQueue(owner, { list: "review" });
    expect(q.rows.find((r) => r.id === "a")!.stage).toBe("follow-it");
    expect(q.rows.find((r) => r.id === "b")!.stage).toBe("hear-it");
  });
});
