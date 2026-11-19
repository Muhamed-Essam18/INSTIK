// Where a month's revenue figures come from (spec 11, contracts/revenue-source.md). Everything after this interface (net revenue, the
// 80/20 pool, shares, rounding, closing, payouts) reads only these figures and never knows how they were obtained. For now an owner
// types them in; a payment gateway can later fill the same record without changing the earnings logic.
// Pure of any database or network code: the manual source is given a function that reads the stored row.

export type RevenueSourceKind = "MANUAL" | "GATEWAY";

export type MonthRevenue = {
  /** "YYYY-MM" in Europe/Warsaw. */
  month: string;
  currency: string;
  grossCents: number;
  vatCents: number;
  feesCents: number;
  refundsCents: number;
  source: RevenueSourceKind;
  /** For optimistic saves of the manual source; a read-only source may use 0. */
  version: number;
};

export interface RevenueSource {
  /** The month's figures, or null when none have been entered yet. Never throws for "not entered". */
  getMonthRevenue(month: string): Promise<MonthRevenue | null>;
}

/** The manual source: reads the figures an owner entered (stored in `MonthlyRevenue`). */
export function createManualRevenueSource(read: (month: string) => Promise<MonthRevenue | null>): RevenueSource {
  return { getMonthRevenue: (month) => read(month) };
}
