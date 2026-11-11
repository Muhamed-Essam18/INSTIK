// The one place a price, a currency or a saving is defined. The pricing page, settings, checkout and
// scripts/stripe-setup.ts all read it. No `server-only` and no `@/` imports, so the setup script can import it.

export type Period = "monthly" | "yearly";
export const periods: readonly Period[] = ["monthly", "yearly"];

export const billing = {
  currency: "eur",
  taxInclusive: true,
  productName: "Instik Full access",
  /** Minor units (cents). `null` while prices are placeholders. */
  amounts: { monthly: null, yearly: null } as { monthly: number | null; yearly: number | null },
};

export type BillingConfig = typeof billing;

const PLACEHOLDER_PRICE = "[PRICE]";
const PLACEHOLDER_SAVING = "[Save X%]";

const isAmount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

/** True when both amounts are real (positive whole numbers of minor units). */
export function pricesAreSet(config: BillingConfig = billing): boolean {
  return isAmount(config.amounts.monthly) && isAmount(config.amounts.yearly);
}

/** Whole percent the yearly price saves against twelve months, rounded down; null while placeholders or when yearly is not cheaper. */
export function yearlySavingPercent(config: BillingConfig = billing): number | null {
  const { monthly, yearly } = config.amounts;
  if (!isAmount(monthly) || !isAmount(yearly)) return null;
  const saving = Math.floor(100 * (1 - yearly / (12 * monthly)));
  return saving > 0 ? saving : null;
}

/** "[PRICE]" while placeholders, otherwise the amount in the configured currency, e.g. "€9.00". */
export function priceLabel(period: Period, config: BillingConfig = billing): string {
  const amount = config.amounts[period];
  if (!isAmount(amount)) return PLACEHOLDER_PRICE;
  return new Intl.NumberFormat("en", { style: "currency", currency: config.currency.toUpperCase() }).format(amount / 100);
}

export function periodLabel(period: Period): string {
  return period === "monthly" ? "per month" : "per year";
}

/** "[Save X%]" while placeholders, otherwise "Save 25%". */
export function savingLabel(config: BillingConfig = billing): string {
  const percent = yearlySavingPercent(config);
  return percent === null ? PLACEHOLDER_SAVING : `Save ${percent}%`;
}

/** The Stripe lookup key for a period's Price. It changes when the amount does, so a new amount means a new Price. */
export function lookupKey(period: Period, config: BillingConfig = billing): string {
  return `instik_full_${period}_${config.currency}_${config.amounts[period] ?? "placeholder"}`;
}

/** Throws, naming the field, when the config is inconsistent. Never includes anything from the environment. */
export function validateBilling(config: BillingConfig = billing): void {
  if (!/^[a-z]{3}$/.test(config.currency)) throw new Error("billing.currency must be three lower-case letters");
  const { monthly, yearly } = config.amounts;
  if (monthly === null && yearly === null) return;
  if (!isAmount(monthly)) throw new Error("billing.amounts.monthly must be a positive whole number, or both amounts null");
  if (!isAmount(yearly)) throw new Error("billing.amounts.yearly must be a positive whole number, or both amounts null");
  if (yearly >= 12 * monthly) throw new Error("billing.amounts.yearly must be less than 12 times the monthly amount");
  if (yearly <= monthly) throw new Error("billing.amounts.yearly must be greater than the monthly amount");
}

/** Billing can start a charge only with real prices, a Stripe secret key and a webhook secret. */
export function billingReady(
  env: { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string },
  config: BillingConfig = billing,
): boolean {
  return pricesAreSet(config) && Boolean(env.STRIPE_SECRET_KEY) && Boolean(env.STRIPE_WEBHOOK_SECRET);
}
