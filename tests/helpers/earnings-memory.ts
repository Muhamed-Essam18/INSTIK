import { buildDashboard, type DashboardStore, type VideoStat } from "@/lib/earnings/dashboard-data";
import { createManualRevenueSource, type MonthRevenue } from "@/lib/earnings/revenue-source";
import {
  createEarningsService,
  type AdjustmentRecord,
  type ClosedMonth,
  type CreatorViewCount,
  type EarningRecord,
  type EarningsStore,
  type EarningsTx,
  type PayoutRow,
  type RevenueSave,
} from "@/lib/earnings/service";
import type { Actor } from "@/lib/roles/actor";

// An in-memory stand-in for the earnings store so the earnings service's rules run with no database. A transaction rolls back
// everything it did if it throws, and a lock serialises two callers, as the real row lock does.

export const owner: Actor = { id: "boss", email: "boss@x.com", name: "Boss", role: "owner" };
export const secondOwner: Actor = { id: "boss2", email: "boss2@x.com", name: "Second", role: "owner" };
export const creatorActor = (id = "ann"): Actor => ({ id, email: `${id}@x.com`, name: id, role: "creator" });
export const learnerActor: Actor = { id: "lea", email: "lea@x.com", name: null, role: "learner" };

export type RevenueChangeRow = { month: string; currency: string; grossCents: number; vatCents: number; feesCents: number; refundsCents: number; version: number; byId: string; at: Date };

export type EarningsState = {
  revenue: Map<string, MonthRevenue>;
  changes: RevenueChangeRow[];
  adjustments: AdjustmentRecord[];
  closed: Map<string, ClosedMonth>;
  earnings: Map<string, EarningRecord[]>;
  payouts: PayoutRow[];
  /** Counted views per creator, by month. */
  views: Map<string, CreatorViewCount[]>;
};

// Raw rows for the creator dashboard tests: the in-memory dashboard store computes every figure from these, like the real queries do.
export type DashVideo = { id: string; creatorId: string; title: string; stage: string | null; status: string; duration: number };
export type DashCounted = { creatorId: string; userId: string; videoId: string; warsawDay: string; month: string };
export type DashWatch = { videoId: string; userId: string; day: string; seconds: number };
export type DashProgress = { videoId: string; userId: string; position: number; watched?: boolean };
export type DashAnswer = { videoId: string; answer: "MOSTLY" | "SOME" | "NOT_YET" };
export type DashData = {
  videos?: DashVideo[];
  counted?: DashCounted[];
  watch?: DashWatch[];
  progress?: DashProgress[];
  answers?: DashAnswer[];
  names?: Record<string, { name: string; languageCode: string | null }>;
  requests?: { id: string; stage: string; topic: string; text: string }[];
};

export type EarningsSetup = {
  revenue?: Record<string, Partial<MonthRevenue>>;
  views?: Record<string, CreatorViewCount[]>;
  dashboard?: DashData;
  now?: string;
};

export const creatorViews = (id: string, views: number, joinedDay = 1, name = id.toUpperCase()): CreatorViewCount => ({
  id,
  name,
  joinedAt: new Date(Date.UTC(2026, 0, joinedDay)),
  views,
});

export const figures = (over: Partial<MonthRevenue> = {}): Omit<MonthRevenue, "month"> => ({
  currency: "EUR",
  grossCents: 300_000,
  vatCents: 56_100,
  feesCents: 9_600,
  refundsCents: 4_300,
  source: "MANUAL",
  version: 1,
  ...over,
});

export function setupEarnings(setup: EarningsSetup = {}) {
  const clock = { now: new Date(setup.now ?? "2026-12-03T10:00:00Z") };
  const state: EarningsState = {
    revenue: new Map(Object.entries(setup.revenue ?? {}).map(([month, r]) => [month, { month, ...figures(), ...r }])),
    changes: [],
    adjustments: [],
    closed: new Map(),
    earnings: new Map(),
    payouts: [],
    views: new Map(Object.entries(setup.views ?? {})),
  };
  let seq = 0;
  const nextId = (p: string) => `${p}${(seq += 1)}`;

  const snapshot = () => ({
    revenue: new Map(state.revenue),
    changes: [...state.changes],
    adjustments: [...state.adjustments],
    closed: new Map(state.closed),
    earnings: new Map(state.earnings),
    payouts: [...state.payouts],
  });

  const tx: EarningsTx = {
    lockMonth: async (month) => state.closed.get(month) ?? null,
    getRevenue: async (month) => state.revenue.get(month) ?? null,
    saveRevenue: async (row: RevenueSave) => {
      state.revenue.set(row.month, {
        month: row.month,
        currency: row.currency,
        grossCents: row.grossCents,
        vatCents: row.vatCents,
        feesCents: row.feesCents,
        refundsCents: row.refundsCents,
        source: "MANUAL",
        version: row.version,
      });
      state.changes.push({
        month: row.month,
        currency: row.currency,
        grossCents: row.grossCents,
        vatCents: row.vatCents,
        feesCents: row.feesCents,
        refundsCents: row.refundsCents,
        version: row.version,
        byId: row.updatedById,
        at: new Date(clock.now),
      });
    },
    adjustments: async (month) => state.adjustments.filter((a) => a.month === month),
    insertAdjustment: async (row) => {
      state.adjustments.push({ ...row, id: nextId("adj") });
    },
    creatorViews: async (month) => (state.views.get(month) ?? []).filter((c) => c.views > 0),
    closeMonth: async (month, earnings) => {
      state.closed.set(month.month, month);
      state.earnings.set(month.month, earnings);
    },
    lockEarning: async (month, creatorId) => (state.earnings.get(month) ?? []).find((e) => e.creatorId === creatorId) ?? null,
    payoutsFor: async (month, creatorId) => state.payouts.filter((p) => p.month === month && p.creatorId === creatorId),
    getPayout: async (id) => state.payouts.find((p) => p.id === id) ?? null,
    insertPayout: async (row) => {
      state.payouts.push({ ...row, id: nextId("pay") });
    },
  };

  // A lock: one transaction at a time, in the order they ask.
  let tail: Promise<unknown> = Promise.resolve();

  const store: EarningsStore = {
    transaction: (work) => {
      const run = tail.then(async () => {
        const backup = snapshot();
        try {
          return await work(tx);
        } catch (error) {
          Object.assign(state, backup);
          throw error;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    },
    knownMonths: async () => {
      const months = new Set<string>([...state.revenue.keys(), ...state.views.keys(), ...state.closed.keys()]);
      return [...months].map((month) => ({ month, closed: state.closed.has(month) }));
    },
    getRevenue: async (month) => state.revenue.get(month) ?? null,
    getClosed: async (month) => state.closed.get(month) ?? null,
    creatorViews: async (month) => (state.views.get(month) ?? []).filter((c) => c.views > 0),
    adjustments: async (month) => state.adjustments.filter((a) => a.month === month),
    earnings: async (month) => state.earnings.get(month) ?? [],
    payouts: async (month) => state.payouts.filter((p) => p.month === month),
  };

  const revenue = createManualRevenueSource(async (month) => state.revenue.get(month) ?? null);

  // The dashboard's reads, computed from raw rows. Every one is filtered by the creator id it is given.
  const dash = setup.dashboard ?? {};
  const dashCalls: { creatorId: string; month: string; minute: string }[] = [];
  const dashReads: string[] = [];
  const read = <T,>(name: string, value: T): T => {
    dashReads.push(name);
    return value;
  };
  const mine = (creatorId: string) => (dash.videos ?? []).filter((v) => v.creatorId === creatorId);
  const inMonth = (day: string, month: string) => day.startsWith(month);
  const dashStore: DashboardStore = {
    creatorInfo: async (id) => read("creatorInfo", dash.names?.[id] ?? { name: id, languageCode: "arz" }),
    videoCounts: async (id) => {
      const v = mine(id);
      const n = (status: string) => v.filter((x) => x.status === status).length;
      return read("videoCounts", { uploaded: v.length, inReview: n("IN_REVIEW"), approved: n("APPROVED"), changes: n("CHANGES_REQUESTED") });
    },
    countedViewsByDay: async (id, from, to) => {
      const days = new Map<string, number>();
      for (const c of (dash.counted ?? []).filter((x) => x.creatorId === id && x.warsawDay >= from && x.warsawDay <= to)) days.set(c.warsawDay, (days.get(c.warsawDay) ?? 0) + 1);
      return read("countedViewsByDay", [...days].map(([day, count]) => ({ day, count })));
    },
    monthStats: async (id, month) => {
      const rows = (dash.counted ?? []).filter((x) => x.creatorId === id && x.month === month);
      return read("monthStats", { views: rows.length, learners: new Set(rows.map((r) => r.userId)).size });
    },
    videoStats: async (id, month) => {
      const out: VideoStat[] = [];
      for (const video of mine(id)) {
        const views = (dash.counted ?? []).filter((c) => c.creatorId === id && c.videoId === video.id && c.month === month).length;
        const watched = (dash.watch ?? []).filter((w) => w.videoId === video.id && inMonth(w.day, month));
        if (views === 0 && watched.length === 0) continue;
        const learners = new Set(watched.map((w) => w.userId));
        const progress = (dash.progress ?? []).filter((p) => p.videoId === video.id && learners.has(p.userId));
        const shares = progress.map((p) => (p.watched ? 1 : Math.min(1, p.position / video.duration)));
        const answers = (dash.answers ?? []).filter((a) => a.videoId === video.id);
        out.push({
          videoId: video.id,
          title: video.title,
          stage: video.stage,
          views,
          watchSeconds: watched.reduce((n, w) => n + w.seconds, 0),
          completion: shares.length > 0 ? shares.reduce((a, b) => a + b, 0) / shares.length : null,
          answers: { mostly: answers.filter((a) => a.answer === "MOSTLY").length, some: answers.filter((a) => a.answer === "SOME").length, notYet: answers.filter((a) => a.answer === "NOT_YET").length },
        });
      }
      return read("videoStats", out);
    },
    creatorViews: async (month) => read("creatorViews", (state.views.get(month) ?? []).filter((c) => c.views > 0)),
    adjustments: async (month) => read("adjustments", state.adjustments.filter((a) => a.month === month)),
    lastMonth: async (id, month) =>
      read("lastMonth", {
        closed: state.closed.get(month) ?? null,
        earning: (state.earnings.get(month) ?? []).find((e) => e.creatorId === id) ?? null,
        payouts: state.payouts.filter((p) => p.month === month && p.creatorId === id),
      }),
  };
  const openRequests = async () => read("requests", dash.requests ?? []);
  // A plain function in place of the cached reader (tests never touch next/cache). It records which creator id the service asked for.
  const readDashboard = async (creatorId: string, month: string, minute: string) => {
    dashCalls.push({ creatorId, month, minute });
    return buildDashboard({ store: dashStore, revenue, openRequests }, creatorId, month, new Date(minute));
  };

  const service = createEarningsService({ store, revenue, readDashboard, now: () => clock.now });
  return { state, store, tx, service, revenue, clock, dashStore, dashCalls, dashReads, readDashboard };
}
