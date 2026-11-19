import { addDays } from "@/lib/hours/days";
import { monthKeyOf, previousMonth } from "@/lib/time/warsaw";
import { bucketByWeek, lastFiveWeeks } from "./months";
import type { RevenueSource } from "./revenue-source";
import { CURRENCY, isPaid, nextPayoutDay, type PayoutRecord } from "./rules";
import type { AdjustmentRecord, ClosedMonth, CreatorViewCount, EarningRecord, PayoutRow } from "./service";
import { computeStatement } from "./split";

// What one creator's dashboard shows (spec 11 User Story 3, docs/design/CreatorDashboard.dc.html), built from reads that are ALL scoped to one
// creator id. The result has no field for another creator, the month's total revenue or the pool, and no learner is identified.
// Plain data only (strings, numbers, dates), so it can be cached per creator. No database or cache code here: the store is passed in.

export type DashboardCounts = { uploaded: number; inReview: number; approved: number; changes: number };

export type AnswerCounts = { mostly: number; some: number; notYet: number };

export type VideoStat = {
  videoId: string;
  title: string;
  stage: string | null;
  /** Counted views of this video this month. */
  views: number;
  /** All honest watch time on this video this month, counted or not. */
  watchSeconds: number;
  /** The average share of the video that learners watched this month (0 to 1), or null when nobody watched it. */
  completion: number | null;
  answers: AnswerCounts;
};

export type RequestView = { id: string; stage: string; topic: string; text: string };

export interface DashboardStore {
  videoCounts(creatorId: string): Promise<DashboardCounts>;
  /** This creator's counted views per Warsaw day, from `fromDay` to `toDay` inclusive. */
  countedViewsByDay(creatorId: string, fromDay: string, toDay: string): Promise<{ day: string; count: number }[]>;
  /** This creator's counted views this month and how many different learners produced them (a number, never who). */
  monthStats(creatorId: string, month: string): Promise<{ views: number; learners: number }>;
  /** This creator's videos that were watched or counted this month. */
  videoStats(creatorId: string, month: string): Promise<VideoStat[]>;
  /** Every creator's counted views this month: used only inside `buildDashboard` to work out this creator's share, never returned. */
  creatorViews(month: string): Promise<CreatorViewCount[]>;
  adjustments(month: string): Promise<AdjustmentRecord[]>;
  /** A closed month as this creator sees it: the closing, their own frozen earning and their own payout records. Never another creator's. */
  lastMonth(creatorId: string, month: string): Promise<{ closed: ClosedMonth | null; earning: EarningRecord | null; payouts: PayoutRow[] }>;
  creatorInfo(creatorId: string): Promise<{ name: string; languageCode: string | null } | null>;
}

export type LastMonth =
  | { month: string; state: "open" }
  | { month: string; state: "final"; earningsCents: number; currency: string; paid: boolean; paidAt: Date | null };

export type DashboardData = {
  creatorName: string;
  languageCode: string | null;
  month: string;
  counts: DashboardCounts;
  views: number;
  watchSeconds: number;
  learners: number;
  /** 0 to 1, or null when no video was watched this month. */
  averageCompletion: number | null;
  weeks: { label: string; count: number; current: boolean }[];
  top: VideoStat[];
  earnings: {
    /** This month's estimate for this creator, or null while no revenue has been entered. Never zero in place of "not available". */
    estimateCents: number | null;
    currency: string;
    lastMonth: LastMonth;
    /** "YYYY-MM-DD": the 5th of next month. Display only. */
    nextPayoutDay: string;
  };
  requests: RequestView[];
};

export type BuildDeps = {
  store: DashboardStore;
  revenue: RevenueSource;
  /** Open content requests, newest first (spec 11 User Story 6). Optional until requests exist. */
  openRequests?: () => Promise<RequestView[]>;
};

const TOP_VIDEOS = 5;

export async function buildDashboard(deps: BuildDeps, creatorId: string, month: string, now: Date): Promise<DashboardData> {
  const { store } = deps;
  const weeks = lastFiveWeeks(now);
  const previous = previousMonth(month);

  // Ten reads, run together (research.md section 10). Every one is scoped to this creator except `everyone`, which only feeds their share.
  const [info, counts, stats, perDay, videoStats, everyone, adjustments, revenue, last, requests] = await Promise.all([
    store.creatorInfo(creatorId),
    store.videoCounts(creatorId),
    store.monthStats(creatorId, month),
    store.countedViewsByDay(creatorId, weeks[0].start, addDays(weeks[weeks.length - 1].start, 6)),
    store.videoStats(creatorId, month),
    store.creatorViews(month),
    store.adjustments(month),
    deps.revenue.getMonthRevenue(month),
    store.lastMonth(creatorId, previous),
    deps.openRequests ? deps.openRequests() : Promise.resolve([]),
  ]);

  // This creator's estimate: the month's statement (all creators' counts, used inside this function only), then only this creator's line.
  let estimateCents: number | null = null;
  if (revenue) {
    const statement = computeStatement({ revenue, adjustmentsCents: adjustments.reduce((sum, a) => sum + a.amountCents, 0), creators: everyone });
    estimateCents = statement.lines.find((l) => l.id === creatorId)?.earningsCents ?? 0;
  }

  let lastMonth: LastMonth = { month: previous, state: "open" };
  if (last.closed) {
    const earningsCents = last.earning?.earningsCents ?? 0;
    const paid = isPaid(earningsCents, last.payouts as PayoutRecord[]);
    const paidAt = paid ? (last.payouts.filter((p) => p.kind === "PAID").sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.at ?? null) : null;
    lastMonth = { month: previous, state: "final", earningsCents, currency: last.earning?.currency ?? last.closed.currency, paid, paidAt };
  }

  const watched = videoStats.filter((v) => v.completion !== null);
  const averageCompletion = watched.length > 0 ? watched.reduce((sum, v) => sum + (v.completion ?? 0), 0) / watched.length : null;
  const top = videoStats
    .filter((v) => v.views > 0)
    .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title))
    .slice(0, TOP_VIDEOS);

  return {
    creatorName: info?.name ?? "",
    languageCode: info?.languageCode ?? null,
    month: month || monthKeyOf(now),
    counts,
    views: stats.views,
    watchSeconds: videoStats.reduce((sum, v) => sum + v.watchSeconds, 0),
    learners: stats.learners,
    averageCompletion,
    weeks: bucketByWeek(perDay, weeks).map((count, i) => ({ label: weeks[i].label, count, current: weeks[i].current })),
    top,
    earnings: { estimateCents, currency: revenue?.currency ?? CURRENCY, lastMonth, nextPayoutDay: nextPayoutDay(now) },
    requests,
  };
}
