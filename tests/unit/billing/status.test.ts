import { describe, expect, it } from "vitest";
import {
  checkoutSessionSchema,
  invoiceSchema,
  parseCheckoutSession,
  parseEventEnvelope,
  parseInvoice,
  parseSubscription,
} from "@/lib/billing/schemas";
import { formatPlanDate, mapStatus, mapSubscription, planDisplay } from "@/lib/billing/status";
import {
  checkoutSessionFixture,
  eventFixture,
  subscriptionFixture,
  T_START,
  yearlySubscriptionFixture,
} from "../../helpers/stripe-fixtures";

const map = (fixture: unknown) => {
  const parsed = parseSubscription(fixture);
  if (!parsed.ok) throw new Error("fixture did not parse");
  return mapSubscription(parsed.data);
};

describe("mapSubscription", () => {
  it("maps an active monthly subscription", () => {
    const mapped = map(subscriptionFixture())!;
    expect(mapped).toMatchObject({
      stripeSubscriptionId: "sub_1",
      customerId: "cus_1",
      metadataUserId: "user-a",
      status: "ACTIVE",
      plan: "MONTHLY",
      cancelAtPeriodEnd: false,
    });
    expect(mapped.currentPeriodEnd.getTime()).toBe((T_START + 30 * 86_400) * 1000);
    expect(mapped.stripeCreatedAt.getTime()).toBe(T_START * 1000);
  });

  it("maps an active yearly subscription", () => {
    expect(map(yearlySubscriptionFixture())!.plan).toBe("YEARLY");
  });

  it("falls back to the recurring interval when the price has no lookup key", () => {
    const fixture = subscriptionFixture({
      items: {
        data: [{ current_period_end: T_START + 100, price: { id: "p", lookup_key: null, recurring: { interval: "year" } } }],
      },
    });
    expect(map(fixture)!.plan).toBe("YEARLY");
  });

  it("returns null when the plan cannot be told", () => {
    const fixture = subscriptionFixture({
      items: {
        data: [{ current_period_end: T_START + 100, price: { id: "p", lookup_key: null, recurring: { interval: "week" } } }],
      },
    });
    expect(map(fixture)).toBeNull();
  });

  it("keeps the cancel-at-period-end flag, past due and canceled", () => {
    expect(map(subscriptionFixture({ cancel_at_period_end: true }))!.cancelAtPeriodEnd).toBe(true);
    expect(map(subscriptionFixture({ status: "past_due" }))!.status).toBe("PAST_DUE");
    expect(map(subscriptionFixture({ status: "canceled" }))!.status).toBe("CANCELED");
  });

  it("maps an unknown Stripe status to one that gives no access", () => {
    expect(mapStatus("something_new")).toBe("INCOMPLETE_EXPIRED");
    expect(map(subscriptionFixture({ status: "something_new" }))!.status).toBe("INCOMPLETE_EXPIRED");
  });

  it("accepts the customer as an expanded object", () => {
    expect(map(subscriptionFixture({ customer: { id: "cus_9" } }))!.customerId).toBe("cus_9");
  });
});

describe("schemas reject malformed payloads without echoing them", () => {
  const secret = "SECRET-VALUE-123";
  it.each([
    ["no items", subscriptionFixture({ items: { data: [] } })],
    ["no customer", subscriptionFixture({ customer: undefined })],
    ["status not a string", subscriptionFixture({ status: 5 })],
    ["no period end", subscriptionFixture({ items: { data: [{ price: { id: "p" } }] }, metadata: { x: secret } })],
    ["not an object", secret],
  ])("subscription: %s", (_name, payload) => {
    const result = parseSubscription(payload);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("event envelope needs an id, a type and an object", () => {
    expect(parseEventEnvelope(eventFixture("customer.subscription.updated", { id: "sub_1" })).ok).toBe(true);
    expect(parseEventEnvelope({ id: "evt_1", type: "x" }).ok).toBe(false);
    expect(parseEventEnvelope({ type: "x", data: { object: {} } }).ok).toBe(false);
  });

  it("checkout session and invoice", () => {
    const session = parseCheckoutSession(checkoutSessionFixture());
    expect(session.ok && session.data.subscription).toBe("sub_1");
    expect(checkoutSessionSchema.safeParse({ client_reference_id: "x" }).success).toBe(false);
    const invoice = parseInvoice({ parent: { subscription_details: { subscription: "sub_1" } } });
    expect(invoice.ok && invoice.data.parent?.subscription_details?.subscription).toBe("sub_1");
    expect(invoiceSchema.safeParse({}).success).toBe(true);
  });
});

describe("planDisplay", () => {
  const now = new Date("2026-03-01T12:00:00Z");
  const row = (status: "ACTIVE" | "PAST_DUE" | "CANCELED", cancelAtPeriodEnd = false, end = "2026-03-14T10:00:00Z") => ({
    status,
    plan: "MONTHLY" as const,
    cancelAtPeriodEnd,
    currentPeriodEnd: new Date(end),
  });

  it("is free with no row", () => {
    expect(planDisplay(null, now)).toEqual({ state: "free" });
  });
  it("is active with the renewal date", () => {
    expect(planDisplay(row("ACTIVE"), now)).toMatchObject({ state: "active", plan: "MONTHLY", dateLabel: "14 March 2026" });
  });
  it("is ending when cancelled before the period end", () => {
    expect(planDisplay(row("ACTIVE", true), now)).toMatchObject({ state: "ending", dateLabel: "14 March 2026" });
  });
  it("is past due while access continues", () => {
    expect(planDisplay(row("PAST_DUE", false, "2026-02-27T10:00:00Z"), now).state).toBe("past-due");
  });
  it("is ended once the subscription has ended", () => {
    expect(planDisplay(row("CANCELED"), now)).toEqual({ state: "ended" });
  });
  it("is ended when the safety net has passed", () => {
    expect(planDisplay(row("ACTIVE", false, "2026-02-01T00:00:00Z"), now)).toEqual({ state: "ended" });
  });
});

describe("formatPlanDate", () => {
  const date = new Date("2026-03-13T23:30:00Z");
  it("uses the learner's time zone", () => {
    expect(formatPlanDate(date, "UTC")).toBe("13 March 2026");
    expect(formatPlanDate(date, "Africa/Cairo")).toBe("14 March 2026");
  });
  it("falls back to UTC for a missing or invalid zone", () => {
    expect(formatPlanDate(date, null)).toBe("13 March 2026");
    expect(formatPlanDate(date, "Not/AZone")).toBe("13 March 2026");
  });
});
