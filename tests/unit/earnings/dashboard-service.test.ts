import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/roles/forbidden";
import type { Actor } from "@/lib/roles/actor";
import { creatorActor, creatorViews, learnerActor, owner, setupEarnings, type DashData } from "../../helpers/earnings-memory";

// The creator dashboard (spec 11 User Story 3; FR-008 to FR-015, FR-014: a creator only ever receives their own numbers).

const NOW = "2026-11-11T12:00:00Z";
const video = (id: string, creatorId: string, status: string, title = `Video ${id}`, duration = 600, stage: string | null = "follow-it") => ({ id, creatorId, status, title, duration, stage });

// Ann: 14 videos (10 approved, 2 in review, 1 with changes requested, 1 draft). Bob has one.
const annVideos = [
  video("v1", "ann", "APPROVED", "At the café", 600, "follow-it"),
  video("v2", "ann", "APPROVED", "My family", 400, "hear-it"),
  ...Array.from({ length: 8 }, (_, i) => video(`v${i + 3}`, "ann", "APPROVED")),
  video("r1", "ann", "IN_REVIEW"),
  video("r2", "ann", "IN_REVIEW"),
  video("c1", "ann", "CHANGES_REQUESTED"),
  video("d1", "ann", "DRAFT"),
];

const dashboard: DashData = {
  videos: [...annVideos, video("b1", "bob", "APPROVED", "Bob's secret video")],
  counted: [
    { creatorId: "ann", userId: "u1", videoId: "v1", warsawDay: "2026-11-03", month: "2026-11" },
    { creatorId: "ann", userId: "u2", videoId: "v1", warsawDay: "2026-11-04", month: "2026-11" },
    { creatorId: "ann", userId: "u1", videoId: "v1", warsawDay: "2026-11-10", month: "2026-11" },
    { creatorId: "ann", userId: "u3", videoId: "v2", warsawDay: "2026-11-05", month: "2026-11" },
    { creatorId: "ann", userId: "u1", videoId: "v2", warsawDay: "2026-11-11", month: "2026-11" },
    { creatorId: "ann", userId: "u1", videoId: "v1", warsawDay: "2026-10-20", month: "2026-10" },
    ...Array.from({ length: 4 }, (_, i) => ({ creatorId: "bob", userId: `x${i}`, videoId: "b1", warsawDay: "2026-11-06", month: "2026-11" })),
  ],
  watch: [
    { videoId: "v1", userId: "u1", day: "2026-11-03", seconds: 1_800 },
    { videoId: "v1", userId: "u2", day: "2026-11-04", seconds: 1_800 },
    { videoId: "v2", userId: "u3", day: "2026-11-05", seconds: 3_600 },
    { videoId: "v1", userId: "u1", day: "2026-10-20", seconds: 999 },
    { videoId: "b1", userId: "x0", day: "2026-11-06", seconds: 5_000 },
  ],
  progress: [
    { videoId: "v1", userId: "u1", position: 300 },
    { videoId: "v1", userId: "u2", position: 10, watched: true },
    { videoId: "v2", userId: "u3", position: 100 },
  ],
  answers: [
    ...Array.from({ length: 7 }, () => ({ videoId: "v1", answer: "MOSTLY" as const })),
    { videoId: "v1", answer: "SOME" as const },
    { videoId: "v1", answer: "SOME" as const },
    { videoId: "v1", answer: "NOT_YET" as const },
    ...Array.from({ length: 3 }, () => ({ videoId: "v2", answer: "NOT_YET" as const })),
  ],
  names: { ann: { name: "Ann", languageCode: "arz" }, bob: { name: "Bob", languageCode: "arz" } },
};

const setup = (over: Parameters<typeof setupEarnings>[0] = {}) =>
  setupEarnings({
    now: NOW,
    dashboard,
    views: { "2026-11": [creatorViews("ann", 300, 1, "Ann"), creatorViews("bob", 100, 2, "Bob")] },
    ...over,
  });

describe("getDashboard: the numbers", () => {
  it("counts videos by status (14 uploaded: 10 approved, 2 in review, 1 with changes requested, 1 draft)", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.counts).toEqual({ uploaded: 14, inReview: 2, approved: 10, changes: 1 });
  });

  it("shows this month's counted views, watch time, unique learners and average completion", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.views).toBe(5);
    expect(d.learners).toBe(3);
    expect(d.watchSeconds).toBe(7_200); // 1,800 + 1,800 + 3,600: October's 999 seconds and Bob's 5,000 are not in it
    // v1: learners u1 (300 of 600 = 0.5) and u2 (watched = 1) -> 0.75; v2: u3 (100 of 400 = 0.25); mean of the two videos = 0.5
    expect(d.averageCompletion).toBeCloseTo(0.5, 5);
  });

  it("gives five weekly bars with the current week in progress", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.weeks.map((w) => w.count)).toEqual([0, 1, 0, 3, 2]);
    expect(d.weeks.map((w) => w.current)).toEqual([false, false, false, false, true]);
    expect(d.weeks.map((w) => w.label)).toEqual(["Oct 12", "Oct 19", "Oct 26", "Nov 2", "Nov 9"]);
  });

  it("lists the top videos by counted views with their فاهم؟ answers", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.top.map((v) => [v.title, v.views, v.watchSeconds])).toEqual([
      ["At the café", 3, 3_600],
      ["My family", 2, 3_600],
    ]);
    expect(d.top[0].answers).toEqual({ mostly: 7, some: 2, notYet: 1 });
    expect(d.top[1].answers).toEqual({ mostly: 0, some: 0, notYet: 3 });
    expect(d.top[0].completion).toBeCloseTo(0.75, 5);
  });

  it("shows at most five top videos", async () => {
    const many: DashData = {
      videos: Array.from({ length: 7 }, (_, i) => video(`m${i}`, "ann", "APPROVED", `Many ${i}`)),
      counted: Array.from({ length: 7 }, (_, i) => ({ creatorId: "ann", userId: "u1", videoId: `m${i}`, warsawDay: "2026-11-03", month: "2026-11" })),
    };
    const d = await setupEarnings({ now: NOW, dashboard: many }).service.getDashboard(creatorActor("ann"));
    expect(d.top).toHaveLength(5);
  });

  it("gives zeros and empty lists to a brand-new creator, never an error", async () => {
    const d = await setup().service.getDashboard(creatorActor("newbie"));
    expect(d.counts).toEqual({ uploaded: 0, inReview: 0, approved: 0, changes: 0 });
    expect(d).toMatchObject({ views: 0, learners: 0, watchSeconds: 0, averageCompletion: null, top: [], requests: [] });
    expect(d.weeks.map((w) => w.count)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("getDashboard: earnings", () => {
  it("estimates this month's share from the revenue entered: 75% of an 1,840.00 pool is 1,380.00", async () => {
    const d = await setup({ revenue: { "2026-11": {} } }).service.getDashboard(creatorActor("ann"));
    expect(d.earnings.estimateCents).toBe(138_000);
    expect(d.earnings.currency).toBe("EUR");
    const bob = await setup({ revenue: { "2026-11": {} } }).service.getDashboard(creatorActor("bob"));
    expect(bob.earnings.estimateCents).toBe(46_000);
  });

  it("says the estimate is not available yet (null, never zero) while no revenue has been entered", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.earnings.estimateCents).toBeNull();
    expect(d.views).toBe(5);
  });

  it("estimates zero for a creator with no counted views once revenue exists", async () => {
    const d = await setup({ revenue: { "2026-11": {} } }).service.getDashboard(creatorActor("newbie"));
    expect(d.earnings.estimateCents).toBe(0);
  });

  it("shows the next payout day: the 5th of next month", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.earnings.nextPayoutDay).toBe("2026-12-05");
  });

  it("shows last month as not final yet while it is open", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(d.earnings.lastMonth).toEqual({ month: "2026-10", state: "open" });
  });
});

describe("getDashboard: a creator only ever receives their own numbers", () => {
  it("gives each creator only their own videos, views and earnings, and nothing of the month's total or pool", async () => {
    const t = setup({ revenue: { "2026-11": {} } });
    const ann = await t.service.getDashboard(creatorActor("ann"));
    const bob = await t.service.getDashboard(creatorActor("bob"));

    expect(bob.counts.uploaded).toBe(1);
    expect(bob.views).toBe(4);
    expect(bob.top.map((v) => v.title)).toEqual(["Bob's secret video"]);
    expect(ann.top.map((v) => v.title)).not.toContain("Bob's secret video");

    const annJson = JSON.stringify(ann);
    expect(annJson).not.toContain("Bob");
    expect(annJson).not.toContain("bob");
    expect(annJson).not.toContain("184000"); // the creator pool
    expect(annJson).not.toContain("46000"); // Bob's earnings
    expect(annJson).not.toContain("230000"); // net revenue
    expect(annJson).not.toContain("300000"); // gross revenue

    // The result type has no field for anyone else, the pool, the totals or the revenue.
    expect(Object.keys(ann).sort()).toEqual(
      ["averageCompletion", "counts", "creatorName", "earnings", "languageCode", "learners", "month", "requests", "top", "views", "watchSeconds", "weeks"].sort(),
    );
    expect(Object.keys(ann.earnings).sort()).toEqual(["currency", "estimateCents", "lastMonth", "nextPayoutDay"]);
  });

  it("identifies no learner: only counts", async () => {
    const d = await setup().service.getDashboard(creatorActor("ann"));
    expect(JSON.stringify(d)).not.toMatch(/\bu[123]\b|@/);
  });

  it("takes only the actor, and asks the reader for the actor's own id, never one from input", async () => {
    const t = setup();
    expect(t.service.getDashboard.length).toBe(1);
    await t.service.getDashboard(creatorActor("ann"));
    expect(t.dashCalls).toEqual([{ creatorId: "ann", month: "2026-11", minute: "2026-11-11T12:00:00.000Z" }]);
  });

  it("refuses a learner, an owner who is not a creator, and nobody, with no read at all", async () => {
    for (const actor of [learnerActor, owner, null, undefined] as (Actor | null | undefined)[]) {
      const t = setup();
      await expect(t.service.getDashboard(actor)).rejects.toBeInstanceOf(ForbiddenError);
      expect(t.dashCalls).toHaveLength(0);
      expect(t.dashReads).toHaveLength(0);
    }
  });

  it("serves a paused creator (they still see their numbers) and an owner who is also a creator (their own)", async () => {
    const paused = await setup().service.getDashboard({ ...creatorActor("ann"), paused: true });
    expect(paused.counts.uploaded).toBe(14);
    const both = await setup().service.getDashboard({ id: "ann", email: "ann@x.com", name: "Ann", role: "owner", isCreator: true });
    expect(both.counts.uploaded).toBe(14);
  });
});

describe("getDashboard: the read budget", () => {
  it("issues at most ten reads for one dashboard, run together", async () => {
    const t = setup({ revenue: { "2026-11": {} } });
    await t.service.getDashboard(creatorActor("ann"));
    expect(t.dashReads.length).toBeLessThanOrEqual(10);
    expect(new Set(t.dashReads).size).toBe(t.dashReads.length);
  });
});

describe("getDashboard: last month once it is closed (final, paid or payment pending)", () => {
  const closedOctober = { month: "2026-10", closedAt: new Date("2026-11-01T00:10:00Z"), closedById: "boss", currency: "EUR", grossCents: 300_000, vatCents: 56_100, feesCents: 9_600, refundsCents: 4_300, adjustmentsCents: 0, netCents: 230_000, poolCents: 184_000, instikCents: 46_000, totalViews: 400 };
  const earnings = [
    { creatorId: "ann", creatorName: "Ann", views: 300, earningsCents: 138_000, currency: "EUR" },
    { creatorId: "bob", creatorName: "Bob", views: 100, earningsCents: 46_000, currency: "EUR" },
  ];
  const withClosedOctober = () => {
    const t = setup();
    t.state.closed.set("2026-10", closedOctober);
    t.state.earnings.set("2026-10", earnings);
    return t;
  };

  it("shows the final amount with 'payment pending' until the creator is marked as paid", async () => {
    const d = await withClosedOctober().service.getDashboard(creatorActor("ann"));
    expect(d.earnings.lastMonth).toEqual({ month: "2026-10", state: "final", earningsCents: 138_000, currency: "EUR", paid: false, paidAt: null });
  });

  it("shows paid, and when, once the owner has marked the creator as paid", async () => {
    const t = withClosedOctober();
    t.state.payouts.push({ id: "p1", month: "2026-10", creatorId: "ann", kind: "PAID", amountCents: 138_000, currency: "EUR", reference: "TR-1", byId: "boss", at: new Date("2026-11-05T09:00:00Z"), reversesId: null });
    const d = await t.service.getDashboard(creatorActor("ann"));
    expect(d.earnings.lastMonth).toEqual({ month: "2026-10", state: "final", earningsCents: 138_000, currency: "EUR", paid: true, paidAt: new Date("2026-11-05T09:00:00Z") });
  });

  it("goes back to payment pending when the payment is undone", async () => {
    const t = withClosedOctober();
    t.state.payouts.push(
      { id: "p1", month: "2026-10", creatorId: "ann", kind: "PAID", amountCents: 138_000, currency: "EUR", reference: "TR-1", byId: "boss", at: new Date("2026-11-05T09:00:00Z"), reversesId: null },
      { id: "p2", month: "2026-10", creatorId: "ann", kind: "REVERSAL", amountCents: 138_000, currency: "EUR", reference: "Wrong account", byId: "boss", at: new Date("2026-11-06T09:00:00Z"), reversesId: "p1" },
    );
    const d = await t.service.getDashboard(creatorActor("ann"));
    expect(d.earnings.lastMonth).toMatchObject({ state: "final", paid: false, paidAt: null });
  });

  it("shows a creator with no views that month a final zero, and never another creator's payout", async () => {
    const t = withClosedOctober();
    t.state.payouts.push({ id: "p1", month: "2026-10", creatorId: "bob", kind: "PAID", amountCents: 46_000, currency: "EUR", reference: "BOB-ONLY", byId: "boss", at: new Date("2026-11-05T09:00:00Z"), reversesId: null });
    const newbie = await t.service.getDashboard(creatorActor("newbie"));
    expect(newbie.earnings.lastMonth).toEqual({ month: "2026-10", state: "final", earningsCents: 0, currency: "EUR", paid: false, paidAt: null });
    const ann = await t.service.getDashboard(creatorActor("ann"));
    expect(ann.earnings.lastMonth).toMatchObject({ paid: false });
    expect(JSON.stringify(ann)).not.toContain("BOB-ONLY");
    expect(JSON.stringify(ann)).not.toContain("46000");
  });
});

describe("getDashboard: requests from Instik", () => {
  it("shows the open requests newest first, at most 20, and never a closed one", async () => {
    const { setupRequests } = await import("../../helpers/requests-memory");
    const requests = setupRequests();
    const ownerActor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" } as const;
    for (let i = 1; i <= 23; i += 1) {
      requests.clock.now = new Date(Date.UTC(2026, 10, 1, 0, i));
      await requests.service.createRequest(ownerActor, { stage: "follow-it", topic: "food", text: `Request ${i}` });
    }
    await requests.service.closeRequest(ownerActor, { id: requests.state.rows[22].id }); // the newest one is closed

    const open = (await requests.store.listOpen(20)).map((r) => ({ id: r.id, stage: r.stage, topic: r.topic, text: r.text }));
    const t = setupEarnings({ now: NOW, dashboard: { requests: open } });
    const d = await t.service.getDashboard(creatorActor("ann"));
    expect(d.requests).toHaveLength(20);
    expect(d.requests[0].text).toBe("Request 22");
    expect(d.requests.map((r) => r.text)).not.toContain("Request 23");
    expect(d.requests.at(-1)!.text).toBe("Request 3");
  });

  it("gives every creator the same requests", async () => {
    const t = setupEarnings({ now: NOW, dashboard: { requests: [{ id: "r1", stage: "hear-it", topic: "family", text: "Introducing your family." }] } });
    const ann = await t.service.getDashboard(creatorActor("ann"));
    const bob = await t.service.getDashboard(creatorActor("bob"));
    expect(ann.requests).toEqual(bob.requests);
  });
});
