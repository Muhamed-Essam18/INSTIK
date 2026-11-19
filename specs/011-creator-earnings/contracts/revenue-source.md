# Contract: RevenueSource

The earnings logic reads one month's revenue only through this interface. Nothing after it (net, pool, shares, rounding, closing,
payouts) may know where the figures came from.

```ts
type MonthRevenue = {
  month: string;            // "YYYY-MM", Europe/Warsaw
  currency: string;         // "EUR"
  grossCents: number;       // integer, >= 0
  vatCents: number;         // integer, >= 0
  feesCents: number;        // integer, >= 0
  refundsCents: number;     // integer, >= 0
  source: "MANUAL" | "GATEWAY";
  version: number;          // for optimistic saves; a read-only source may use 0
};

interface RevenueSource {
  /** The month's figures, or null when none have been entered yet. Never throws for "not entered". */
  getMonthRevenue(month: string): Promise<MonthRevenue | null>;
}
```

## ManualRevenueSource (the only implementation now)

- Reads `MonthlyRevenue`. Also exposes the owner's write side (used only by the owner service): `saveMonthRevenue(actor, { month, figures,
  expectedVersion })`, which validates, refuses closed months, checks the version, writes the row and a `RevenueChange` in one transaction.
- No network calls. No gateway keys. Nothing in `src/lib/earnings/split.ts` imports this file.

## A future gateway source

- Implements `getMonthRevenue` from the gateway, or writes the same `MonthlyRevenue` row with `source = "GATEWAY"` (then the owner form is read-only).
- Must return the same four figures in integer cents and the same month key; no other change to the earnings code.

## Contract test

`computeStatement` is called with the figures from the manual source and from a fake second source holding the same numbers; both give an identical
statement (SC-011).
