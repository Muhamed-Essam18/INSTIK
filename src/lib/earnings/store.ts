import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { DashboardStore } from "./dashboard-data";
import { CURRENCY } from "./rules";
import type { MonthRevenue } from "./revenue-source";
import type {
  AdjustmentRecord,
  ClosedMonth,
  CreatorViewCount,
  EarningRecord,
  EarningsStore,
  EarningsTx,
  PayoutRow,
} from "./service";

// The Prisma side of the earnings (spec 11). The only file here that queries the database. It reads counted views, revenue, frozen
// months, earnings, adjustments and payouts, and writes them only through the service's transactions. Rows that must never change
// (history, closed months) are also protected by the database triggers in the `creator_earnings_triggers` migration.

type Client = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const toRevenue = (row: {
  month: string;
  currency: string;
  grossCents: number;
  vatCents: number;
  feesCents: number;
  refundsCents: number;
  source: "MANUAL" | "GATEWAY";
  version: number;
}): MonthRevenue => ({ ...row });

const toClosed = (row: {
  month: string;
  closedAt: Date | null;
  closedById: string | null;
  currency: string;
  grossCents: number;
  vatCents: number;
  feesCents: number;
  refundsCents: number;
  adjustmentsCents: number;
  netCents: number;
  poolCents: number;
  instikCents: number;
  totalViews: number;
}): ClosedMonth => ({ ...row, closedAt: row.closedAt ?? new Date(0) });

const toPayout = (row: PayoutRow): PayoutRow => ({ ...row });

/** Reads shared by the plain client and a transaction. */
function reads(p: Client) {
  return {
    async getRevenue(month: string): Promise<MonthRevenue | null> {
      const row = await p.monthlyRevenue.findUnique({ where: { month } });
      return row ? toRevenue(row) : null;
    },
    async adjustments(month: string): Promise<AdjustmentRecord[]> {
      return p.revenueAdjustment.findMany({ where: { month }, orderBy: { at: "asc" } });
    },
    async creatorViews(month: string): Promise<CreatorViewCount[]> {
      const grouped = await p.countedView.groupBy({ by: ["creatorId"], where: { monthKey: month, creatorId: { not: null } }, _count: { _all: true } });
      const ids = grouped.flatMap((g) => (g.creatorId ? [g.creatorId] : []));
      if (ids.length === 0) return [];
      const users = await p.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true, createdAt: true, host: { select: { name: true } } },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      return grouped.flatMap((g) => {
        const user = g.creatorId ? byId.get(g.creatorId) : undefined;
        if (!user) return [];
        return [{ id: user.id, name: user.host?.name.trim() || user.name?.trim() || user.email, joinedAt: user.createdAt, views: g._count._all }];
      });
    },
  };
}

export const prismaEarningsStore: EarningsStore = {
  transaction: (work) =>
    db().$transaction(async (p) => {
      const shared = reads(p);
      const tx: EarningsTx = {
        async lockMonth(month) {
          // The month row may not exist yet: make sure it does (open, zeros), then take the row lock so two owners cannot both change it.
          await p.$executeRaw`INSERT INTO "EarningsMonth" ("month","status","currency","grossCents","vatCents","feesCents","refundsCents","adjustmentsCents","netCents","poolCents","instikCents","totalViews")
            VALUES (${month},'OPEN',${CURRENCY},0,0,0,0,0,0,0,0,0) ON CONFLICT ("month") DO NOTHING`;
          await p.$queryRaw`SELECT "month" FROM "EarningsMonth" WHERE "month" = ${month} FOR UPDATE`;
          const row = await p.earningsMonth.findUnique({ where: { month } });
          return row && row.status === "CLOSED" ? toClosed(row) : null;
        },
        getRevenue: shared.getRevenue,
        async saveRevenue(row) {
          const data = {
            currency: row.currency,
            grossCents: row.grossCents,
            vatCents: row.vatCents,
            feesCents: row.feesCents,
            refundsCents: row.refundsCents,
            version: row.version,
            updatedById: row.updatedById,
          };
          await p.monthlyRevenue.upsert({
            where: { month: row.month },
            create: { month: row.month, source: "MANUAL", ...data },
            update: data,
          });
          await p.revenueChange.create({
            data: {
              month: row.month,
              currency: row.currency,
              grossCents: row.grossCents,
              vatCents: row.vatCents,
              feesCents: row.feesCents,
              refundsCents: row.refundsCents,
              version: row.version,
              byId: row.updatedById,
            },
          });
        },
        adjustments: shared.adjustments,
        async insertAdjustment(row) {
          await p.revenueAdjustment.create({ data: { month: row.month, amountCents: row.amountCents, currency: row.currency, note: row.note, byId: row.byId, at: row.at } });
        },
        creatorViews: shared.creatorViews,
        async closeMonth(month, earnings) {
          await p.earningsMonth.update({
            where: { month: month.month },
            data: {
              status: "CLOSED",
              closedAt: month.closedAt,
              closedById: month.closedById,
              currency: month.currency,
              grossCents: month.grossCents,
              vatCents: month.vatCents,
              feesCents: month.feesCents,
              refundsCents: month.refundsCents,
              adjustmentsCents: month.adjustmentsCents,
              netCents: month.netCents,
              poolCents: month.poolCents,
              instikCents: month.instikCents,
              totalViews: month.totalViews,
            },
          });
          if (earnings.length > 0) {
            await p.creatorEarning.createMany({
              data: earnings.map((e) => ({
                month: month.month,
                creatorId: e.creatorId,
                creatorName: e.creatorName,
                views: e.views,
                earningsCents: e.earningsCents,
                currency: e.currency,
              })),
            });
          }
        },
        async lockEarning(month, creatorId) {
          await p.$queryRaw`SELECT "id" FROM "CreatorEarning" WHERE "month" = ${month} AND "creatorId" = ${creatorId} FOR UPDATE`;
          const row = await p.creatorEarning.findFirst({ where: { month, creatorId } });
          return row ? { creatorId: row.creatorId, creatorName: row.creatorName, views: row.views, earningsCents: row.earningsCents, currency: row.currency } : null;
        },
        async payoutsFor(month, creatorId) {
          return (await p.payout.findMany({ where: { month, creatorId }, orderBy: { at: "asc" } })).map(toPayout);
        },
        async getPayout(id) {
          const row = await p.payout.findUnique({ where: { id } });
          return row ? toPayout(row) : null;
        },
        async insertPayout(row) {
          await p.payout.create({ data: row });
        },
      };
      return work(tx);
    }),

  async knownMonths() {
    const [revenue, views, months] = await Promise.all([
      db().monthlyRevenue.findMany({ select: { month: true } }),
      db().countedView.groupBy({ by: ["monthKey"] }),
      db().earningsMonth.findMany({ select: { month: true, status: true } }),
    ]);
    const closed = new Set(months.filter((m) => m.status === "CLOSED").map((m) => m.month));
    const all = new Set<string>([...revenue.map((r) => r.month), ...views.map((v) => v.monthKey), ...months.map((m) => m.month)]);
    return [...all].map((month) => ({ month, closed: closed.has(month) }));
  },

  getRevenue: (month) => reads(db()).getRevenue(month),

  async getClosed(month) {
    const row = await db().earningsMonth.findUnique({ where: { month } });
    return row && row.status === "CLOSED" ? toClosed(row) : null;
  },

  creatorViews: (month) => reads(db()).creatorViews(month),
  adjustments: (month) => reads(db()).adjustments(month),

  async earnings(month): Promise<EarningRecord[]> {
    const rows = await db().creatorEarning.findMany({ where: { month }, orderBy: { earningsCents: "desc" } });
    return rows.map((r) => ({ creatorId: r.creatorId, creatorName: r.creatorName, views: r.views, earningsCents: r.earningsCents, currency: r.currency }));
  },

  async payouts(month) {
    const rows = (await db().payout.findMany({ where: { month }, orderBy: { at: "asc" } })).map(toPayout);
    const ids = [...new Set(rows.flatMap((r) => (r.byId ? [r.byId] : [])))];
    const people = ids.length ? await db().user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
    const label = new Map(people.map((u) => [u.id, u.name?.trim() || u.email]));
    return rows.map((r) => ({ ...r, byName: r.byId ? (label.get(r.byId) ?? null) : null }));
  },
};

// ---- The creator dashboard's reads (spec 11 User Story 3) ----
// Every query is filtered by one creator id. Month and day boundaries were set at insert time (CountedView.monthKey and warsawDay);
// watch time uses WatchSession.day, a learner-day label that belongs to the month its date falls in.

const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dateToDay = (date: Date) => date.toISOString().slice(0, 10);

type VideoRow = {
  id: string;
  title: string;
  stage: string | null;
  views: number;
  seconds: number;
  completion: number | null;
  mostly: number;
  some: number;
  not_yet: number;
};

export const prismaDashboardStore: DashboardStore = {
  async creatorInfo(creatorId) {
    const user = await db().user.findUnique({ where: { id: creatorId }, select: { name: true, email: true, host: { select: { name: true, languageCode: true } } } });
    if (!user) return null;
    return { name: user.host?.name.trim() || user.name?.trim() || user.email, languageCode: user.host?.languageCode ?? null };
  },

  async videoCounts(creatorId) {
    const rows = await db().video.groupBy({ by: ["status"], where: { deletedAt: null, host: { is: { userId: creatorId } } }, _count: { _all: true } });
    const n = (status: string) => rows.filter((r) => r.status === status).reduce((sum, r) => sum + r._count._all, 0);
    return { uploaded: rows.reduce((sum, r) => sum + r._count._all, 0), inReview: n("IN_REVIEW"), approved: n("APPROVED"), changes: n("CHANGES_REQUESTED") };
  },

  async countedViewsByDay(creatorId, fromDay, toDay) {
    const rows = await db().countedView.groupBy({
      by: ["warsawDay"],
      where: { creatorId, warsawDay: { gte: dayToDate(fromDay), lte: dayToDate(toDay) } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ day: dateToDay(r.warsawDay), count: r._count._all }));
  },

  async monthStats(creatorId, month) {
    const rows = await db().$queryRaw<{ views: number; learners: number }[]>`
      SELECT COUNT(*)::int AS "views", COUNT(DISTINCT "userId")::int AS "learners"
      FROM "CountedView" WHERE "creatorId" = ${creatorId} AND "monthKey" = ${month}`;
    return { views: rows[0]?.views ?? 0, learners: rows[0]?.learners ?? 0 };
  },

  async videoStats(creatorId, month) {
    const from = `${month}-01`;
    const [year, mm] = month.split("-").map(Number);
    const to = mm === 12 ? `${year + 1}-01-01` : `${year}-${String(mm + 1).padStart(2, "0")}-01`;
    // One round trip: the creator's videos with this month's counted views, honest watch time, completion and فاهم؟ answers.
    const rows = await db().$queryRaw<VideoRow[]>`
      WITH mine AS (
        SELECT v."id", v."languageCode", v."slug", v."title", v."stage", v."durationSeconds"
        FROM "Video" v JOIN "Host" h ON h."id" = v."hostId"
        WHERE h."userId" = ${creatorId} AND v."deletedAt" IS NULL
      ),
      watch AS (
        SELECT m."id", SUM(w."seconds")::int AS "seconds"
        FROM mine m JOIN "WatchSession" w ON w."languageCode" = m."languageCode" AND w."videoSlug" = m."slug"
        WHERE w."day" >= ${from}::date AND w."day" < ${to}::date GROUP BY m."id"
      ),
      views AS (
        SELECT "videoId" AS "id", COUNT(*)::int AS "views" FROM "CountedView"
        WHERE "creatorId" = ${creatorId} AND "monthKey" = ${month} GROUP BY "videoId"
      ),
      done AS (
        SELECT m."id",
          AVG(CASE WHEN p."watched" THEN 1.0 ELSE LEAST(1.0, p."positionSeconds"::float / NULLIF(m."durationSeconds", 0)) END)::float AS "completion"
        FROM mine m JOIN "VideoProgress" p ON p."languageCode" = m."languageCode" AND p."videoSlug" = m."slug"
        WHERE EXISTS (
          SELECT 1 FROM "WatchSession" w WHERE w."userId" = p."userId" AND w."languageCode" = p."languageCode" AND w."videoSlug" = p."videoSlug"
            AND w."day" >= ${from}::date AND w."day" < ${to}::date
        ) GROUP BY m."id"
      ),
      ans AS (
        SELECT m."id",
          COUNT(*) FILTER (WHERE a."answer" = 'MOSTLY')::int AS "mostly",
          COUNT(*) FILTER (WHERE a."answer" = 'SOME')::int AS "some",
          COUNT(*) FILTER (WHERE a."answer" = 'NOT_YET')::int AS "not_yet"
        FROM mine m JOIN "ComprehensionAnswer" a ON a."languageCode" = m."languageCode" AND a."videoSlug" = m."slug" GROUP BY m."id"
      )
      SELECT m."id", m."title", m."stage",
        COALESCE(views."views", 0) AS "views", COALESCE(watch."seconds", 0) AS "seconds", done."completion" AS "completion",
        COALESCE(ans."mostly", 0) AS "mostly", COALESCE(ans."some", 0) AS "some", COALESCE(ans."not_yet", 0) AS "not_yet"
      FROM mine m
      LEFT JOIN watch ON watch."id" = m."id" LEFT JOIN views ON views."id" = m."id"
      LEFT JOIN done ON done."id" = m."id" LEFT JOIN ans ON ans."id" = m."id"
      WHERE views."views" IS NOT NULL OR watch."seconds" IS NOT NULL`;
    return rows.map((r) => ({
      videoId: r.id,
      title: r.title,
      stage: r.stage,
      views: Number(r.views),
      watchSeconds: Number(r.seconds),
      completion: r.completion === null ? null : Number(r.completion),
      answers: { mostly: Number(r.mostly), some: Number(r.some), notYet: Number(r.not_yet) },
    }));
  },

  creatorViews: (month) => reads(db()).creatorViews(month),
  adjustments: (month) => reads(db()).adjustments(month),

  async lastMonth(creatorId, month) {
    const [closed, earning, payouts] = await Promise.all([
      db().earningsMonth.findUnique({ where: { month } }),
      db().creatorEarning.findFirst({ where: { month, creatorId } }),
      db().payout.findMany({ where: { month, creatorId }, orderBy: { at: "asc" } }),
    ]);
    return {
      closed: closed && closed.status === "CLOSED" ? toClosed(closed) : null,
      earning: earning ? { creatorId: earning.creatorId, creatorName: earning.creatorName, views: earning.views, earningsCents: earning.earningsCents, currency: earning.currency } : null,
      payouts: payouts.map(toPayout),
    };
  },
};
