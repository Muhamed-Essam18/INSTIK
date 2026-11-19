import { hasRole, type Actor } from "@/lib/roles/actor";
import { ForbiddenError } from "@/lib/roles/forbidden";
import { hasMonthEnded, isMonthKey, monthKeyOf } from "@/lib/time/warsaw";
import { CURRENCY, isPaid, validateAdjustment, validateReference, validateRevenue, type PayoutRecord, type RevenueFigures } from "./rules";
import type { MonthRevenue, RevenueSource } from "./revenue-source";
import type { AdjustmentRefusal, CloseRefusal, PayoutRefusal, SaveReason, RevenueField } from "./messages";
import { computeStatement } from "./split";
import type { DashboardData } from "./dashboard-data";

// The owner's earnings (spec 11): the monthly statement, revenue entry, and the creator numbers. The database (`EarningsStore`) and the
// revenue source are passed in, so the rules are tested without them. Every owner function checks the owner role first and throws
// `ForbiddenError` before touching the store; creator functions are scoped to the acting creator's own id.

export type AdjustmentRecord = { id: string; month: string; amountCents: number; currency: string; note: string; byId: string | null; at: Date };

/** One creator's counted views in a month (only creators with at least one). `joinedAt` decides ties when leftover cents are shared out. */
export type CreatorViewCount = { id: string; name: string; joinedAt: Date; views: number };

export type ClosedMonth = {
  month: string;
  closedAt: Date;
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
};

export type EarningRecord = { creatorId: string | null; creatorName: string; views: number; earningsCents: number; currency: string };

export type PayoutRow = {
  id: string;
  month: string;
  creatorId: string | null;
  kind: "PAID" | "REVERSAL";
  amountCents: number;
  currency: string;
  reference: string;
  byId: string | null;
  /** The owner's name when the payout is read for display (history); not stored, and not needed to write one. */
  byName?: string | null;
  at: Date;
  reversesId: string | null;
};

export type RevenueSave = RevenueFigures & { month: string; currency: string; version: number; updatedById: string };

export interface EarningsTx {
  /** Locks the month's row (creating it open when it is missing) and returns it when the month is closed. */
  lockMonth(month: string): Promise<ClosedMonth | null>;
  getRevenue(month: string): Promise<MonthRevenue | null>;
  /** Writes the month's revenue (insert or update) and appends the matching `RevenueChange`, in this transaction. */
  saveRevenue(row: RevenueSave): Promise<void>;
  adjustments(month: string): Promise<AdjustmentRecord[]>;
  insertAdjustment(row: Omit<AdjustmentRecord, "id" | "at"> & { at: Date }): Promise<void>;
  creatorViews(month: string): Promise<CreatorViewCount[]>;
  /** Stores the frozen month and one earning per creator, and marks the month closed. */
  closeMonth(month: ClosedMonth, earnings: EarningRecord[]): Promise<void>;
  /** Locks and returns one creator's frozen earning for a closed month. */
  lockEarning(month: string, creatorId: string): Promise<EarningRecord | null>;
  payoutsFor(month: string, creatorId: string): Promise<PayoutRow[]>;
  getPayout(id: string): Promise<PayoutRow | null>;
  insertPayout(row: Omit<PayoutRow, "id">): Promise<void>;
}

export interface EarningsStore {
  transaction<T>(work: (tx: EarningsTx) => Promise<T>): Promise<T>;
  /** Months that have revenue, counted views or a closing, with whether each is closed. */
  knownMonths(): Promise<{ month: string; closed: boolean }[]>;
  getRevenue(month: string): Promise<MonthRevenue | null>;
  getClosed(month: string): Promise<ClosedMonth | null>;
  creatorViews(month: string): Promise<CreatorViewCount[]>;
  adjustments(month: string): Promise<AdjustmentRecord[]>;
  earnings(month: string): Promise<EarningRecord[]>;
  payouts(month: string): Promise<PayoutRow[]>;
}

/** Reads one creator's dashboard (cached in the real app). The service passes it only the acting creator's own id, never one from input. */
export type ReadDashboard = (creatorId: string, month: string, minute: string) => Promise<DashboardData>;

export type Deps = {
  store: EarningsStore;
  revenue: RevenueSource;
  /** A dependency, not a public helper: only `instance.ts` wires the real cached reader (tests pass a plain function). */
  readDashboard?: ReadDashboard;
  now?: () => Date;
};

export type StatementLineView = {
  creatorId: string | null;
  name: string;
  views: number;
  shareBasisPoints: number;
  /** Null while the month is open and no revenue has been entered. */
  earningsCents: number | null;
  /** Null while the month is open. */
  payout: "paid" | "unpaid" | null;
  paidAt: Date | null;
};

export type StatementView = {
  month: string;
  final: boolean;
  closedAt: Date | null;
  closedById: string | null;
  currency: string;
  revenue: MonthRevenue | null;
  adjustments: AdjustmentRecord[];
  adjustmentsCents: number;
  netCents: number | null;
  netFloored: boolean;
  poolCents: number | null;
  instikCents: number | null;
  totalViews: number;
  lines: StatementLineView[];
  /** The latest 100 payout records, newest first. */
  payouts: PayoutRow[];
  payoutsTruncated: boolean;
  /** The month has ended in Warsaw time. */
  ended: boolean;
  /** Open, ended and revenue entered. */
  canClose: boolean;
};

export type MonthEntry = { month: string; status: "open" | "closed" };

export type SaveRevenueInput = { month: string; figures: RevenueFigures; expectedVersion: number };
export type SaveRevenueResult = { ok: true; version: number } | { ok: false; reason: SaveReason; field?: RevenueField };

export type AddAdjustmentInput = { month: string; amountCents: number; note: string };
export type AddAdjustmentResult = { ok: true } | { ok: false; reason: AdjustmentRefusal };

export type CloseResult =
  | { ok: true; alreadyClosed: boolean; /** The creators who had counted views (so their dashboards can be refreshed). */ creatorIds: string[] }
  | { ok: false; reason: CloseRefusal };

export type MarkPaidInput = { month: string; creatorId: string; reference: string };
export type PayoutResult = { ok: true } | { ok: false; reason: PayoutRefusal };

const PAYOUT_HISTORY = 100;
const MONTH_LIST = 24;

export const owner = (actor: Actor | null | undefined): Actor => {
  if (!actor || actor.role !== "owner") throw new ForbiddenError();
  return actor;
};

export function createEarningsService(deps: Deps) {
  const now = () => (deps.now ? deps.now() : new Date());

  async function getStatement(actor: Actor | null | undefined, month: string): Promise<StatementView | null> {
    owner(actor);
    if (!isMonthKey(month)) return null;
    const at = now();
    const ended = hasMonthEnded(month, at);
    const closed = await deps.store.getClosed(month);
    const [adjustments, allPayouts] = await Promise.all([deps.store.adjustments(month), deps.store.payouts(month)]);
    const history = [...allPayouts].sort((a, b) => b.at.getTime() - a.at.getTime());
    const base = {
      month,
      adjustments,
      payouts: history.slice(0, PAYOUT_HISTORY),
      payoutsTruncated: history.length > PAYOUT_HISTORY,
      ended,
    };

    if (closed) {
      const earnings = await deps.store.earnings(month);
      const lines = earnings
        .map((e): StatementLineView => {
          const records = allPayouts.filter((p) => p.creatorId === e.creatorId);
          const paid = isPaid(e.earningsCents, records as PayoutRecord[]);
          const latest = records.filter((p) => p.kind === "PAID").sort((a, b) => b.at.getTime() - a.at.getTime())[0];
          return {
            creatorId: e.creatorId,
            name: e.creatorName,
            views: e.views,
            shareBasisPoints: closed.totalViews > 0 ? Math.round((e.views * 10_000) / closed.totalViews) : 0,
            earningsCents: e.earningsCents,
            payout: paid ? "paid" : "unpaid",
            paidAt: paid && latest ? latest.at : null,
          };
        })
        .sort((a, b) => b.views - a.views || String(a.creatorId).localeCompare(String(b.creatorId)));
      return {
        ...base,
        final: true,
        closedAt: closed.closedAt,
        closedById: closed.closedById,
        currency: closed.currency,
        revenue: {
          month,
          currency: closed.currency,
          grossCents: closed.grossCents,
          vatCents: closed.vatCents,
          feesCents: closed.feesCents,
          refundsCents: closed.refundsCents,
          source: "MANUAL",
          version: 0,
        },
        adjustmentsCents: closed.adjustmentsCents,
        netCents: closed.netCents,
        netFloored: closed.grossCents > 0 && closed.netCents === 0,
        poolCents: closed.poolCents,
        instikCents: closed.instikCents,
        totalViews: closed.totalViews,
        lines,
        canClose: false,
      };
    }

    const [revenue, creators] = await Promise.all([deps.revenue.getMonthRevenue(month), deps.store.creatorViews(month)]);
    const adjustmentsCents = adjustments.reduce((sum, a) => sum + a.amountCents, 0);
    const statement = computeStatement({ revenue: revenue ?? { grossCents: 0, vatCents: 0, feesCents: 0, refundsCents: 0 }, adjustmentsCents, creators });
    const lines = statement.lines.map((l): StatementLineView => ({
      creatorId: l.id,
      name: l.name,
      views: l.views,
      shareBasisPoints: l.shareBasisPoints,
      earningsCents: revenue ? l.earningsCents : null,
      payout: null,
      paidAt: null,
    }));
    return {
      ...base,
      final: false,
      closedAt: null,
      closedById: null,
      currency: revenue?.currency ?? CURRENCY,
      revenue,
      adjustmentsCents,
      netCents: revenue ? statement.netCents : null,
      netFloored: revenue ? revenue.grossCents > 0 && statement.rawNetCents <= 0 : false,
      poolCents: revenue ? statement.poolCents : null,
      instikCents: revenue ? statement.instikCents : null,
      totalViews: statement.totalViews,
      lines,
      canClose: ended && revenue !== null,
    };
  }

  /** The months an owner can pick: the current month, then every month with revenue, views or a closing, newest first, at most 24. */
  async function listMonths(actor: Actor | null | undefined): Promise<MonthEntry[]> {
    owner(actor);
    const known = await deps.store.knownMonths();
    const byMonth = new Map<string, boolean>([[monthKeyOf(now()), false]]);
    for (const k of known) byMonth.set(k.month, (byMonth.get(k.month) ?? false) || k.closed);
    return [...byMonth]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, MONTH_LIST)
      .map(([month, closed]) => ({ month, status: closed ? "closed" : "open" }));
  }

  async function saveRevenue(actor: Actor | null | undefined, input: SaveRevenueInput): Promise<SaveRevenueResult> {
    const who = owner(actor);
    if (!isMonthKey(input.month)) return { ok: false, reason: "month" };
    if (input.month > monthKeyOf(now())) return { ok: false, reason: "future" };
    const check = validateRevenue(input.figures);
    if (!check.ok) return { ok: false, reason: check.reason, field: check.field };

    return deps.store.transaction(async (tx): Promise<SaveRevenueResult> => {
      const closed = await tx.lockMonth(input.month);
      if (closed) return { ok: false, reason: "closed" };
      const existing = await tx.getRevenue(input.month);
      if (existing && existing.source !== "MANUAL") return { ok: false, reason: "read-only" };
      const current = existing?.version ?? 0;
      if (input.expectedVersion !== current) return { ok: false, reason: "stale" };
      const version = current + 1;
      await tx.saveRevenue({ ...input.figures, month: input.month, currency: existing?.currency ?? CURRENCY, version, updatedById: who.id });
      return { ok: true, version };
    });
  }

  /**
   * The acting creator's own dashboard. Takes only the actor: the creator id is `actor.id`, so no input can name another creator.
   * Learners and signed-out visitors are refused; an owner who is also a creator gets their own creator dashboard.
   */
  async function getDashboard(actor: Actor | null | undefined): Promise<DashboardData> {
    if (!actor || !hasRole(actor, "creator")) throw new ForbiddenError();
    if (!deps.readDashboard) throw new Error("The dashboard reader is not set up.");
    const at = now();
    return deps.readDashboard(actor.id, monthKeyOf(at), `${at.toISOString().slice(0, 16)}:00.000Z`);
  }

  /**
   * A signed correction entered in an open month, usually for an earlier closed one (a late refund). It changes that month's net revenue before the
   * 80/20 split. The currency is the month's own, copied here and never taken from input. Append-only: a mistake is cancelled by an opposite entry.
   */
  async function addAdjustment(actor: Actor | null | undefined, input: AddAdjustmentInput): Promise<AddAdjustmentResult> {
    const who = owner(actor);
    if (!isMonthKey(input.month)) return { ok: false, reason: "month" };
    if (input.month > monthKeyOf(now())) return { ok: false, reason: "future" };
    const check = validateAdjustment({ amountCents: input.amountCents, note: input.note });
    if (!check.ok) return { ok: false, reason: check.reason };

    return deps.store.transaction(async (tx): Promise<AddAdjustmentResult> => {
      if (await tx.lockMonth(input.month)) return { ok: false, reason: "closed" };
      const revenue = await tx.getRevenue(input.month);
      await tx.insertAdjustment({ month: input.month, amountCents: input.amountCents, currency: revenue?.currency ?? CURRENCY, note: input.note.trim(), byId: who.id, at: now() });
      return { ok: true };
    });
  }

  /**
   * Closes an ended month: stores its frozen figures and every creator's earnings, and locks them. Idempotent: a second call (a double click, two
   * owners) changes nothing and reports alreadyClosed. Refused before the month has ended in Warsaw time, and with no revenue entered.
   */
  async function closeMonth(actor: Actor | null | undefined, month: string): Promise<CloseResult> {
    const who = owner(actor);
    if (!isMonthKey(month)) return { ok: false, reason: "month" };

    const result = await deps.store.transaction(async (tx): Promise<CloseResult> => {
      if (await tx.lockMonth(month)) return { ok: true, alreadyClosed: true, creatorIds: [] };
      const at = now();
      if (!hasMonthEnded(month, at)) return { ok: false, reason: "not-ended" };
      const revenue = await tx.getRevenue(month);
      if (!revenue) return { ok: false, reason: "no-revenue" };

      const adjustmentsCents = (await tx.adjustments(month)).reduce((sum, a) => sum + a.amountCents, 0);
      const statement = computeStatement({ revenue, adjustmentsCents, creators: await tx.creatorViews(month) });
      await tx.closeMonth(
        {
          month,
          closedAt: at,
          closedById: who.id,
          currency: revenue.currency,
          grossCents: revenue.grossCents,
          vatCents: revenue.vatCents,
          feesCents: revenue.feesCents,
          refundsCents: revenue.refundsCents,
          adjustmentsCents,
          netCents: statement.netCents,
          poolCents: statement.poolCents,
          instikCents: statement.instikCents,
          totalViews: statement.totalViews,
        },
        statement.lines.map((l) => ({ creatorId: l.id, creatorName: l.name, views: l.views, earningsCents: l.earningsCents, currency: revenue.currency })),
      );
      return { ok: true, alreadyClosed: false, creatorIds: statement.lines.map((l) => l.id) };
    });

    if (result.ok && result.alreadyClosed) {
      const earned = await deps.store.earnings(month);
      return { ok: true, alreadyClosed: true, creatorIds: earned.flatMap((e) => (e.creatorId ? [e.creatorId] : [])) };
    }
    return result;
  }

  /**
   * Records that a creator has been paid for a closed month. The amount and currency are the frozen earning's own, never from input. Append-only.
   * Refused for an open month, when there is nothing to pay, or when the creator is already marked as paid.
   */
  async function markPaid(actor: Actor | null | undefined, input: MarkPaidInput): Promise<PayoutResult> {
    const who = owner(actor);
    if (!isMonthKey(input.month)) return { ok: false, reason: "month" };
    const reference = validateReference(input.reference);
    if (!reference.ok) return { ok: false, reason: reference.reason };

    return deps.store.transaction(async (tx): Promise<PayoutResult> => {
      if (!(await tx.lockMonth(input.month))) return { ok: false, reason: "open" };
      const earning = await tx.lockEarning(input.month, input.creatorId);
      if (!earning || earning.earningsCents <= 0) return { ok: false, reason: "nothing-to-pay" };
      const records = await tx.payoutsFor(input.month, input.creatorId);
      if (isPaid(earning.earningsCents, records as PayoutRecord[])) return { ok: false, reason: "already-paid" };
      await tx.insertPayout({
        month: input.month,
        creatorId: input.creatorId,
        kind: "PAID",
        amountCents: earning.earningsCents,
        currency: earning.currency,
        reference: reference.value,
        byId: who.id,
        at: now(),
        reversesId: null,
      });
      return { ok: true };
    });
  }

  /** Undoes a payment mistake by adding a reversing record (the payment itself is never edited or deleted); after it, the creator can be marked paid again. */
  async function reversePayout(actor: Actor | null | undefined, input: { payoutId: string; reason: string }): Promise<PayoutResult> {
    const who = owner(actor);
    const reason = validateReference(input.reason);
    if (!reason.ok) return { ok: false, reason: reason.reason };

    return deps.store.transaction(async (tx): Promise<PayoutResult> => {
      const payout = await tx.getPayout(input.payoutId);
      if (!payout || !payout.creatorId) return { ok: false, reason: "not-found" };
      if (payout.kind !== "PAID") return { ok: false, reason: "not-paid" };
      await tx.lockEarning(payout.month, payout.creatorId);
      const records = await tx.payoutsFor(payout.month, payout.creatorId);
      if (records.some((r) => r.kind === "REVERSAL" && r.reversesId === payout.id)) return { ok: false, reason: "already-reversed" };
      await tx.insertPayout({
        month: payout.month,
        creatorId: payout.creatorId,
        kind: "REVERSAL",
        amountCents: payout.amountCents,
        currency: payout.currency,
        reference: reason.value,
        byId: who.id,
        at: now(),
        reversesId: payout.id,
      });
      return { ok: true };
    });
  }

  return { getStatement, listMonths, saveRevenue, addAdjustment, closeMonth, markPaid, reversePayout, getDashboard };
}

export type EarningsService = ReturnType<typeof createEarningsService>;
