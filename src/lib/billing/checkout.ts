import "server-only";
import { db } from "@/lib/db";
import { lookupKey, type Period } from "./plans";
import { parseSubscriptionSummary } from "./schemas";
import { siteOrigin, stripe } from "./stripe";
import { getFreshSubscription } from "./subscription";

// Everything that talks to Stripe on a learner's behalf: the customer, Checkout and the Customer Portal.
// Only the period (a zod-checked enum) comes from a request; amounts and price ids never do.

type Learner = { id: string; email: string; name?: string | null };

/** Subscriptions in these states are "not ended": starting another purchase would risk a second charge. */
const OPEN_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** The learner's Stripe customer id, created (once, idempotently) and remembered on the learner when missing. */
export async function ensureCustomer(learner: Learner): Promise<string> {
  const existing = await db().user.findUnique({ where: { id: learner.id }, select: { stripeCustomerId: true } });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe().customers.create(
    { email: learner.email, name: learner.name ?? undefined, metadata: { userId: learner.id } },
    { idempotencyKey: `customer-${learner.id}` },
  );
  await db().user.updateMany({ where: { id: learner.id, stripeCustomerId: null }, data: { stripeCustomerId: customer.id } });
  const stored = await db().user.findUnique({ where: { id: learner.id }, select: { stripeCustomerId: true } });
  return stored?.stripeCustomerId ?? customer.id;
}

/** The Stripe customer id stored for this learner, if they have started checkout before. */
export async function storedCustomerId(userId: string): Promise<string | null> {
  const user = await db().user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  return user?.stripeCustomerId ?? null;
}

/** A subscription of this customer that has not ended, if Stripe lists one. */
export async function findOpenSubscription(customerId: string): Promise<{ id: string; status: string } | null> {
  const list = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  for (const item of list.data) {
    const parsed = parseSubscriptionSummary(item);
    if (parsed.ok && OPEN_STATUSES.includes(parsed.data.status)) return parsed.data;
  }
  return null;
}

async function findPriceId(period: Period): Promise<string> {
  const prices = await stripe().prices.list({ lookup_keys: [lookupKey(period)], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error(`No Stripe price for ${period}; run scripts/stripe-setup.ts`);
  return price.id;
}

/** A Checkout Session for the learner and period, with Stripe Tax on. Returns the address to send the learner to. */
export async function createCheckoutSession(learner: Learner, period: Period, customerId: string): Promise<string> {
  const origin = siteOrigin();
  const price = await findPriceId(period);
  const bucket = Math.floor(Date.now() / FIVE_MINUTES_MS);
  const session = await stripe().checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: learner.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { userId: learner.id } },
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto" },
      success_url: `${origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    },
    { idempotencyKey: `checkout-${learner.id}-${period}-${bucket}` },
  );
  if (!session.url) throw new Error("Stripe returned no Checkout address");
  return session.url;
}

export type PortalFlow = "cancel";

/**
 * A Customer Portal session for the learner, or null when they have no Stripe customer yet. With `flow: "cancel"` and a
 * subscription, the portal opens on its cancellation confirmation (the cancel is at the end of the paid period).
 */
export async function createPortalSession(learner: { id: string }, flow?: PortalFlow): Promise<string | null> {
  const customer = await storedCustomerId(learner.id);
  if (!customer) return null;

  let flowData: { type: "subscription_cancel"; subscription_cancel: { subscription: string } } | undefined;
  if (flow === "cancel") {
    const row = await getFreshSubscription(learner.id);
    if (row) flowData = { type: "subscription_cancel", subscription_cancel: { subscription: row.stripeSubscriptionId } };
  }
  const session = await stripe().billingPortal.sessions.create({
    customer,
    return_url: `${siteOrigin()}/settings`,
    ...(flowData ? { flow_data: flowData } : {}),
  });
  return session.url;
}
