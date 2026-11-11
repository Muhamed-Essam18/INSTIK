// Makes Stripe match the price config (src/lib/billing/plans.ts): the Product, one recurring Price per period (found by
// lookup key), and the Customer Portal configuration. Safe to run again.
//
//   node scripts/stripe-setup.ts            create or update what is missing
//   node scripts/stripe-setup.ts --check    print differences and exit 1 if there are any; changes nothing
//
// Node 24 runs this TypeScript directly, so it imports plans.ts by relative path (no `@/` alias, no `server-only`).
// Test-mode keys only until launch: a live key is refused unless BILLING_LIVE=true.

import { existsSync } from "node:fs";
import Stripe from "stripe";
import { billing, lookupKey, periods, pricesAreSet, validateBilling, type Period } from "../src/lib/billing/plans.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file); // never overrides values already in the environment
}

const checkOnly = process.argv.includes("--check");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) fail("STRIPE_SECRET_KEY is not set.");
// Keep this check in step with the one in src/lib/env.ts (that module is server-only, so the script cannot import it).
if (key.startsWith("sk_live_") && process.env.BILLING_LIVE !== "true") {
  fail("STRIPE_SECRET_KEY is a live key, but BILLING_LIVE is not set to true. Test-mode keys only until launch.");
}

validateBilling();
if (!pricesAreSet()) {
  console.log("Prices are still placeholders in src/lib/billing/plans.ts, so there is nothing to set up yet.");
  process.exit(0);
}

const stripe = new Stripe(key);
const differences: string[] = [];
const done: string[] = [];
const MARK = "instik";
const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/** Records a difference, and in the setup mode runs the fix. */
async function reconcile(description: string, fix: () => Promise<void>) {
  differences.push(description);
  if (checkOnly) return;
  await fix();
  done.push(description);
}

async function findProduct(): Promise<Stripe.Product | undefined> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  return products.data.find((p) => p.metadata[MARK] === "full-access");
}

async function ensureProduct(): Promise<string | undefined> {
  const existing = await findProduct();
  if (existing) {
    if (existing.name !== billing.productName) {
      await reconcile(`Product name is "${existing.name}", expected "${billing.productName}"`, async () => {
        await stripe.products.update(existing.id, { name: billing.productName });
      });
    }
    return existing.id;
  }
  let id: string | undefined;
  await reconcile(`Product "${billing.productName}" does not exist`, async () => {
    // Choose the product tax code in the dashboard before launch (a general electronically supplied service code is the likely fit).
    id = (await stripe.products.create({ name: billing.productName, metadata: { [MARK]: "full-access" } })).id;
  });
  return id;
}

async function ensurePrice(productId: string | undefined, period: Period): Promise<string | undefined> {
  const lookup = lookupKey(period);
  const found = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  const amount = billing.amounts[period]!;
  const interval = period === "monthly" ? "month" : "year";
  const existing = found.data[0];
  if (existing) {
    const same =
      existing.unit_amount === amount &&
      existing.currency === billing.currency &&
      existing.recurring?.interval === interval &&
      existing.tax_behavior === (billing.taxInclusive ? "inclusive" : "exclusive");
    if (!same) differences.push(`Price ${lookup} exists but differs from the config; create a new lookup key by changing the amount`);
    return existing.id;
  }
  let id: string | undefined;
  await reconcile(`Price ${lookup} (${amount} ${billing.currency}, ${interval}ly) does not exist`, async () => {
    id = (
      await stripe.prices.create({
        product: productId!,
        unit_amount: amount,
        currency: billing.currency,
        recurring: { interval },
        tax_behavior: billing.taxInclusive ? "inclusive" : "exclusive",
        lookup_key: lookup,
        transfer_lookup_key: true,
        metadata: { [MARK]: "full-access", period },
      })
    ).id;
  });
  return id;
}

/** Archives older prices of this product for a period, so only the configured one can be bought. Existing subscriptions keep working. */
async function archiveOlderPrices(productId: string, period: Period) {
  const current = lookupKey(period);
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  for (const price of prices.data) {
    if (price.lookup_key && price.lookup_key !== current && price.lookup_key.startsWith(`instik_full_${period}_`)) {
      await reconcile(`Older price ${price.lookup_key} is still active`, async () => {
        await stripe.prices.update(price.id, { active: false });
      });
    }
  }
}

async function ensurePortal() {
  const wanted: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: { headline: "Manage your Instik plan" },
    default_return_url: `${siteUrl}/settings`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      // Cancel at the end of the paid period, with no survey and no retention offer. The portal also offers to keep the subscription before the end date.
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: { enabled: false, options: [] },
      },
      // Plan changes are off here: the portal can only defer a change to the end of the period for a shorter interval or a
      // lower price, never monthly to yearly, and the product rule is "end of period, no proration" in both directions.
      subscription_update: { enabled: false },
    },
    metadata: { [MARK]: "portal" },
  };

  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const mine = configs.data.find((c) => c.metadata?.[MARK] === "portal");
  if (!mine) {
    await reconcile("Customer Portal configuration does not exist", async () => {
      await stripe.billingPortal.configurations.create(wanted);
    });
    return;
  }
  const cancel = mine.features.subscription_cancel;
  const ok =
    mine.features.payment_method_update.enabled &&
    mine.features.invoice_history.enabled &&
    cancel.enabled &&
    cancel.mode === "at_period_end" &&
    cancel.proration_behavior === "none" &&
    !cancel.cancellation_reason.enabled &&
    !mine.features.subscription_update.enabled;
  if (!ok) {
    await reconcile("Customer Portal configuration differs from the expected one", async () => {
      await stripe.billingPortal.configurations.update(mine.id, wanted as Stripe.BillingPortal.ConfigurationUpdateParams);
    });
  }
}

const productId = await ensureProduct();
for (const period of periods) {
  await ensurePrice(productId, period);
  if (productId) await archiveOlderPrices(productId, period);
}
await ensurePortal();

if (differences.length === 0) {
  console.log("No drift: Stripe matches the price config.");
} else if (checkOnly) {
  console.error("Drift between the price config and Stripe:");
  for (const line of differences) console.error(` - ${line}`);
  process.exit(1);
} else {
  console.log("Updated Stripe:");
  for (const line of done) console.log(` - ${line}`);
}
console.log(
  "Note: plan changes (monthly to yearly) are switched off in the portal. See specs/007-payments-and-access/research.md section 10.",
);
