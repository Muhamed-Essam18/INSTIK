import { describe, expect, it } from "vitest";
import { createCreatorsService, type CreatorsStore, type CreatorsTx, type StatusCounts } from "@/lib/creators/service";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import { createReviewService } from "@/lib/review/service";
import { setupReview, video, owner as reviewOwner } from "../../helpers/review-memory";

const owner: Actor = { id: "boss", email: "boss@instik.test", name: "Boss", role: "owner" };
const creatorActor: Actor = { id: "ann", email: "ann@x.com", name: "Ann", role: "creator" };
const learnerActor: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };

type User = { id: string; role: "LEARNER" | "CREATOR"; email: string; pausedAt: Date | null };
type PauseEvent = { userId: string; kind: "PAUSED" | "RESUMED"; actorId: string; actorLabel: string };

function setup() {
  const state = {
    users: [
      { id: "ann", role: "CREATOR", email: "ann@x.com", pausedAt: null },
      { id: "lea", role: "LEARNER", email: "lea@x.com", pausedAt: null },
      { id: "boss", role: "CREATOR", email: "boss@instik.test", pausedAt: null },
    ] as User[],
    events: [] as PauseEvent[],
    approvals: [] as Date[],
    counts: { live: 4, inReview: 2, changes: 1, rejected: 1, drafts: 3 } as StatusCounts,
    lastUpload: new Date("2026-11-10T09:00:00Z") as Date | null,
  };
  const since: Date[] = [];
  const tx: CreatorsTx = {
    lockUser: async (id) => {
      const u = state.users.find((x) => x.id === id);
      return u ? { ...u } : null;
    },
    setPaused: async (id, pausedAt) => void (state.users.find((x) => x.id === id)!.pausedAt = pausedAt),
    appendPauseEvent: async (e) => void state.events.push(e),
  };
  let tail: Promise<unknown> = Promise.resolve();
  const store: CreatorsStore = {
    transaction: (work) => {
      const run = tail.then(() => work(tx));
      tail = run.catch(() => undefined);
      return run;
    },
    creators: async () => [],
    invites: async () => [],
    profile: async (id) => {
      const u = state.users.find((x) => x.id === id);
      return u ? { ...u, name: u.email, joinedAt: new Date("2026-10-01T00:00:00Z") } : null;
    },
    counts: async () => state.counts,
    approvedSince: async (_id, from) => (since.push(from), state.approvals.filter((a) => a >= from).length),
    lastUploadAt: async () => state.lastUpload,
  };
  const now = new Date("2026-11-13T12:00:00Z");
  const service = createCreatorsService({ store, ownerEmails: ["boss@instik.test"], defaultLanguageCode: "arz", now: () => now });
  return { state, service, since };
}

describe("pauseCreator and resumeCreator", () => {
  it("sets and clears pausedAt and appends one event each, with who did it", async () => {
    const t = setup();
    expect(await t.service.pauseCreator(owner, "ann")).toEqual({ ok: true, changed: true });
    expect(t.state.users[0].pausedAt).toEqual(new Date("2026-11-13T12:00:00Z"));
    expect(t.state.events).toEqual([{ userId: "ann", kind: "PAUSED", actorId: "boss", actorLabel: "Boss" }]);
    expect(await t.service.resumeCreator(owner, "ann")).toEqual({ ok: true, changed: true });
    expect(t.state.users[0].pausedAt).toBeNull();
    expect(t.state.events.map((e) => e.kind)).toEqual(["PAUSED", "RESUMED"]);
  });

  it("is idempotent: asking for the state they are already in appends nothing", async () => {
    const t = setup();
    expect(await t.service.resumeCreator(owner, "ann")).toEqual({ ok: true, changed: false });
    await t.service.pauseCreator(owner, "ann");
    const at = t.state.users[0].pausedAt;
    expect(await t.service.pauseCreator(owner, "ann")).toEqual({ ok: true, changed: false });
    expect(t.state.users[0].pausedAt).toBe(at);
    expect(t.state.events).toHaveLength(1);
  });

  it("two owners pausing at once append a single event", async () => {
    const t = setup();
    await Promise.all([t.service.pauseCreator(owner, "ann"), t.service.pauseCreator({ ...owner, id: "boss2" }, "ann")]);
    expect(t.state.events).toHaveLength(1);
  });

  it("is refused for a learner account, an owner and a missing account, writing nothing", async () => {
    const t = setup();
    for (const id of ["lea", "boss", "nobody"]) expect(await t.service.pauseCreator(owner, id)).toEqual({ ok: false, reason: "not-a-creator" });
    expect(t.state.events).toEqual([]);
    expect(t.state.users.every((u) => u.pausedAt === null)).toBe(true);
  });

  it("is refused for a creator, a learner and nobody calling it (SC-009)", async () => {
    const t = setup();
    for (const actor of [creatorActor, learnerActor, null]) {
      await expect(t.service.pauseCreator(actor, "ann")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(t.service.resumeCreator(actor, "ann")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(t.state.events).toEqual([]);
  });

  it("pausing changes no video status, and a paused creator's videos still appear in the owner queue", async () => {
    const t = setupReview({ videos: [video({ id: "v1", hostUserId: "ann" })] });
    const creators = setup();
    await creators.service.pauseCreator(owner, "ann");
    expect(t.state.videos.get("v1")!.status).toBe("IN_REVIEW");
    const queue = await createReviewService({ store: t.store, mailer: async () => {}, siteOrigin: () => "x" }).getQueue(reviewOwner, { list: "review" });
    expect(queue.rows.map((r) => r.id)).toEqual(["v1"]);
  });
});

describe("getCreatorStats", () => {
  it("returns counts by status, approved this month, joined and last upload dates", async () => {
    const t = setup();
    t.state.approvals.push(new Date("2026-11-02T10:00:00Z"), new Date("2026-10-30T10:00:00Z"));
    const stats = await t.service.getCreatorStats(owner, "ann");
    expect(stats).toMatchObject({
      id: "ann",
      status: "Active",
      counts: { live: 4, inReview: 2, changes: 1, rejected: 1, drafts: 3 },
      approvedThisMonth: 1,
      joinedAt: new Date("2026-10-01T00:00:00Z"),
      lastUploadAt: new Date("2026-11-10T09:00:00Z"),
    });
    // "This month" starts at Warsaw midnight on the 1st.
    expect(t.since[0].toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("says Paused for a paused creator and has no earnings or views in it", async () => {
    const t = setup();
    await t.service.pauseCreator(owner, "ann");
    const stats = (await t.service.getCreatorStats(owner, "ann"))!;
    expect(stats.status).toBe("Paused");
    expect(Object.keys(stats).join(" ")).not.toMatch(/earn|view|revenue|money/i);
  });

  it("is null for a learner or an unknown id, and refused for a creator", async () => {
    const t = setup();
    expect(await t.service.getCreatorStats(owner, "lea")).toBeNull();
    expect(await t.service.getCreatorStats(owner, "nobody")).toBeNull();
    await expect(t.service.getCreatorStats(creatorActor, "ann")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(t.service.listCreators(learnerActor)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
