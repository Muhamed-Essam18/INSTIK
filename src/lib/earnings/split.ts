// The earnings calculation (spec 11, docs/product.md "Creator earnings", constitution XII). Pure: no database, no clock,
// no idea where the revenue figures came from. All amounts are integer cents; BigInt is used inside so that
// `pool x views` can never overflow the safe integer range.
//
// net      = max(0, gross - VAT - payment fees - refunds + adjustments)
// pool     = floor(net x 80 / 100)           (80% of net revenue goes to the creator pool)
// Instik   = net - pool                      (the remainder, so an odd cent goes to Instik and never above the pool)
// creator  = largest-remainder share of the pool by counted views:
//            each creator gets floor(pool x views / total); the cents left over go one at a time to the creators with the
//            largest fractional remainder, ties to the creator who joined earlier, then by id. The shares add up to exactly
//            the pool whenever at least one creator has counted views.

export const CREATOR_POOL_PERCENT = 80;

// BigInt literals (100n) need a newer compile target than this project uses, so constants are built with BigInt().
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10_000);
const TWO = BigInt(2);

export type StatementInput = {
  revenue: { grossCents: number; vatCents: number; feesCents: number; refundsCents: number };
  /** Signed corrections entered in this month for earlier closed months; they change net revenue before the split. */
  adjustmentsCents: number;
  creators: readonly { id: string; name: string; joinedAt: Date; views: number }[];
};

export type StatementLine = {
  id: string;
  name: string;
  views: number;
  /** Share of all counted views in basis points (1/100 of a percent), rounded: for display only, never used for money. */
  shareBasisPoints: number;
  earningsCents: number;
};

export type Statement = {
  /** Gross minus VAT, fees and refunds plus adjustments, before it is floored at zero. */
  rawNetCents: number;
  netCents: number;
  poolCents: number;
  instikCents: number;
  totalViews: number;
  /** Only creators with counted views, most views first (ties by id), whatever order they were passed in. */
  lines: StatementLine[];
};

export function computeStatement(input: StatementInput): Statement {
  const { grossCents, vatCents, feesCents, refundsCents } = input.revenue;
  const rawNetCents = grossCents - vatCents - feesCents - refundsCents + input.adjustmentsCents;
  const netCents = Math.max(0, rawNetCents);
  const poolCents = Number((BigInt(netCents) * BigInt(CREATOR_POOL_PERCENT)) / HUNDRED);
  const instikCents = netCents - poolCents;

  const withViews = input.creators.filter((c) => c.views > 0);
  const totalViews = withViews.reduce((sum, c) => sum + c.views, 0);
  if (totalViews === 0) return { rawNetCents, netCents, poolCents, instikCents, totalViews: 0, lines: [] };

  const pool = BigInt(poolCents);
  const total = BigInt(totalViews);
  const parts = withViews.map((c) => {
    const exact = pool * BigInt(c.views);
    return { creator: c, base: exact / total, remainder: exact % total };
  });

  let leftover = Number(pool - parts.reduce((sum, p) => sum + p.base, ZERO));
  const order = [...parts].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    const joined = a.creator.joinedAt.getTime() - b.creator.joinedAt.getTime();
    if (joined !== 0) return joined;
    return a.creator.id < b.creator.id ? -1 : a.creator.id > b.creator.id ? 1 : 0;
  });
  const extra = new Map<string, number>();
  for (const part of order) {
    if (leftover <= 0) break;
    extra.set(part.creator.id, 1);
    leftover -= 1;
  }

  const lines = parts
    .map(({ creator, base }): StatementLine => ({
      id: creator.id,
      name: creator.name,
      views: creator.views,
      shareBasisPoints: Number((BigInt(creator.views) * TEN_THOUSAND * TWO + total) / (total * TWO)),
      earningsCents: Number(base) + (extra.get(creator.id) ?? 0),
    }))
    .sort((a, b) => b.views - a.views || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { rawNetCents, netCents, poolCents, instikCents, totalViews, lines };
}
