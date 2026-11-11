import { hasFullAccess, type SubscriptionFacts, type SubscriptionStatus } from "./access";
import type { ParsedSubscription } from "./schemas";

// Pure mapping between Stripe's subscription and our row, and from our row to what settings shows.

export type BillingPlanName = "MONTHLY" | "YEARLY";

const known: readonly SubscriptionStatus[] = [
  "INCOMPLETE",
  "INCOMPLETE_EXPIRED",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "UNPAID",
  "PAUSED",
];

/** Stripe's status upper-cased. A value we do not know maps to `INCOMPLETE_EXPIRED`, which gives no access. */
export function mapStatus(stripeStatus: string): SubscriptionStatus {
  const upper = stripeStatus.toUpperCase();
  return (known as readonly string[]).includes(upper) ? (upper as SubscriptionStatus) : "INCOMPLETE_EXPIRED";
}

/** The plan period from the price's lookup key, else from its recurring interval; null when neither says. */
export function mapPlan(item: ParsedSubscription["items"]["data"][number]): BillingPlanName | null {
  const key = item.price.lookup_key ?? "";
  if (key.includes("_monthly_")) return "MONTHLY";
  if (key.includes("_yearly_")) return "YEARLY";
  const interval = item.price.recurring?.interval;
  if (interval === "month") return "MONTHLY";
  if (interval === "year") return "YEARLY";
  return null;
}

export type MappedSubscription = {
  stripeSubscriptionId: string;
  customerId: string;
  metadataUserId: string | null;
  status: SubscriptionStatus;
  plan: BillingPlanName;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCreatedAt: Date;
};

/** The row fields for a parsed Stripe subscription, or null when its plan cannot be told (treated as unreadable). */
export function mapSubscription(subscription: ParsedSubscription): MappedSubscription | null {
  const items = subscription.items.data;
  const plan = mapPlan(items[0]);
  if (!plan) return null;
  const periodEnd = Math.max(...items.map((item) => item.current_period_end));
  return {
    stripeSubscriptionId: subscription.id,
    customerId: subscription.customer,
    metadataUserId: subscription.metadata.userId ?? null,
    status: mapStatus(subscription.status),
    plan,
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCreatedAt: new Date(subscription.created * 1000),
  };
}

export type PlanDisplay =
  | { state: "free" }
  | { state: "ended" }
  | { state: "active" | "ending" | "past-due"; plan: BillingPlanName; periodEnd: Date; dateLabel: string };

/** "14 March 2026", in the learner's time zone when it is valid, otherwise UTC. */
export function formatPlanDate(date: Date, timeZone?: string | null): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: zone }).format(date);
  try {
    return format(timeZone || "UTC");
  } catch {
    return format("UTC");
  }
}

/** What the settings plan section shows for a stored row. */
export function planDisplay(
  row: (SubscriptionFacts & { plan: BillingPlanName }) | null | undefined,
  now: Date,
  timeZone?: string | null,
): PlanDisplay {
  if (!row) return { state: "free" };
  if (!hasFullAccess(row, now)) return { state: "ended" };
  const state = row.status === "PAST_DUE" ? "past-due" : row.cancelAtPeriodEnd ? "ending" : "active";
  return { state, plan: row.plan, periodEnd: row.currentPeriodEnd, dateLabel: formatPlanDate(row.currentPeriodEnd, timeZone) };
}
