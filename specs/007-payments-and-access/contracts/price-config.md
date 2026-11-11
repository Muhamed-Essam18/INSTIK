# Contract: price config

Module: `src/lib/billing/plans.ts`. The only place an amount, a currency or a savings figure is defined (FR-032). Imported by the pricing page, settings, the checkout route and `scripts/stripe-setup.ts`.

## Shape

```ts
export const billing = {
  currency: "eur",                 // ISO 4217, lower case
  taxInclusive: true,
  productName: "Instik Full access",
  amounts: { monthly: null, yearly: null },   // minor units (cents); null while prices are placeholders
} as const;

type Period = "monthly" | "yearly";
```

## Functions

```ts
pricesAreSet(): boolean                       // both amounts are positive integers
yearlySavingPercent(): number | null          // floor(100 * (1 - yearly / (12 * monthly))); null while placeholders or if yearly is not cheaper
priceLabel(period): string                    // "[PRICE]" while placeholders, else Intl currency format, e.g. "€9.00"
periodLabel(period): string                   // "per month" | "per year" (from the Spec 6 copy)
savingLabel(): string                         // "[Save X%]" while placeholders, else "Save 25%"
lookupKey(period): string                     // e.g. "instik_full_monthly_eur_900"; changes when the amount changes
billingReady(env): boolean                    // pricesAreSet() and Stripe secret and webhook secret present
```

## Validation (`validateBilling`, run at build/start and in tests)

- `amounts` are both `null` (placeholder state) or both positive integers; one set and one `null` fails.
- Yearly must be greater than monthly and less than 12 × monthly; otherwise it fails, because the saving would be wrong or negative.
- `currency` is three lower-case letters.
- Failure throws with a message naming the field, never a value from the environment.

## Behaviour

| State | Pricing page | Checkout |
|---|---|---|
| Placeholders (today) | "[PRICE]", "[Save X%]", as in the design | Off; the button goes to onboarding or the library (Spec 6 behaviour) |
| Real amounts, Stripe not configured | Real prices | Off (`billingReady()` false) |
| Real amounts and Stripe configured | Real prices | On |

The Spec 6 `pricing` copy module keeps the plan item lists and FAQ; its `priceMonthly`, `priceYearly` and `saving` strings are removed and read from this module instead.

## `scripts/stripe-setup.ts`

Run with `node scripts/stripe-setup.ts` (test-mode key required; refuses a live key without `BILLING_LIVE=true`). Node 24 runs TypeScript directly, so no new tool is needed; the script therefore imports `plans.ts` by relative path (no `@/` alias, no `server-only`), which is why `plans.ts` stays free of both.

1. Find or create the Product (`productName`).
2. For each period, find the Price by `lookupKey(period)`; create it if missing (recurring interval, `unit_amount`, `currency`, `tax_behavior: "inclusive"`); transfer the lookup key from any older Price.
3. Create or update the Customer Portal configuration: payment-method update and invoice history on; cancel at period end with no survey; resume on; switching between the two Prices on, with `proration_behavior: "none"` and plan changes scheduled for the end of the current period.
4. `--check`: print differences between config and Stripe and exit 1 on any drift; change nothing.

## Test cases (`tests/unit/billing/plans.test.ts`)

placeholder state labels match the design; both-or-neither validation; yearly cheaper than 12 × monthly; saving rounds down (monthly 900, yearly 8100 gives 25); label formatting for the currency; lookup key changes with the amount; `billingReady` false in each missing-piece case; a scan of `src/` (excluding this module and tests) finds no currency symbol next to a digit in learner copy.
