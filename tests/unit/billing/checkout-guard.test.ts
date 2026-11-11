import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscriptionsList: vi.fn(),
  pricesList: vi.fn(),
  sessionsCreate: vi.fn(),
  customersCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  siteOrigin: () => "https://instik.example",
  stripe: () => ({
    subscriptions: { list: mocks.subscriptionsList },
    prices: { list: mocks.pricesList },
    checkout: { sessions: { create: mocks.sessionsCreate } },
    customers: { create: mocks.customersCreate },
  }),
}));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: mocks.userFindUnique, updateMany: mocks.userUpdateMany } }) }));

import { createCheckoutSession, ensureCustomer, findOpenSubscription } from "@/lib/billing/checkout";

const learner = { id: "u1", email: "a@example.com", name: "Amal" };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.pricesList.mockResolvedValue({ data: [{ id: "price_y" }] });
  mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
});

describe("findOpenSubscription", () => {
  it.each(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"])("finds a %s subscription", async (status) => {
    mocks.subscriptionsList.mockResolvedValue({ data: [{ id: "sub_1", status }] });
    expect(await findOpenSubscription("cus_1")).toEqual({ id: "sub_1", status });
  });

  it.each(["canceled", "incomplete_expired"])("ignores a %s subscription", async (status) => {
    mocks.subscriptionsList.mockResolvedValue({ data: [{ id: "sub_1", status }] });
    expect(await findOpenSubscription("cus_1")).toBeNull();
  });

  it("finds the open one among ended ones, and asks Stripe for all statuses of this customer", async () => {
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        { id: "sub_old", status: "canceled" },
        { id: "sub_now", status: "active" },
      ],
    });
    expect(await findOpenSubscription("cus_1")).toEqual({ id: "sub_now", status: "active" });
    expect(mocks.subscriptionsList).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1", status: "all" }));
  });

  it("is null for a customer with no subscriptions, and ignores unreadable items", async () => {
    mocks.subscriptionsList.mockResolvedValue({ data: [{ nope: true }] });
    expect(await findOpenSubscription("cus_1")).toBeNull();
  });
});

describe("createCheckoutSession", () => {
  it("builds the session as the contract says, with Stripe Tax on", async () => {
    const url = await createCheckoutSession(learner, "yearly", "cus_1");
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_1");
    expect(mocks.pricesList).toHaveBeenCalledWith(expect.objectContaining({ lookup_keys: ["instik_full_yearly_eur_placeholder"] }));
    const [params] = mocks.sessionsCreate.mock.calls[0];
    expect(params).toMatchObject({
      mode: "subscription",
      customer: "cus_1",
      client_reference_id: "u1",
      line_items: [{ price: "price_y", quantity: 1 }],
      subscription_data: { metadata: { userId: "u1" } },
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto" },
      success_url: "https://instik.example/billing/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://instik.example/pricing?checkout=cancelled",
    });
  });

  it("uses the same idempotency key for two calls in the same five minutes, and a different one for the other period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:10Z"));
    await createCheckoutSession(learner, "yearly", "cus_1");
    vi.setSystemTime(new Date("2026-11-09T12:03:00Z"));
    await createCheckoutSession(learner, "yearly", "cus_1");
    await createCheckoutSession(learner, "monthly", "cus_1");
    vi.useRealTimers();
    const keys = mocks.sessionsCreate.mock.calls.map(([, options]) => options.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys[0]).toContain("u1");
  });

  it("fails clearly when the price has not been set up in Stripe", async () => {
    mocks.pricesList.mockResolvedValue({ data: [] });
    await expect(createCheckoutSession(learner, "monthly", "cus_1")).rejects.toThrow(/stripe-setup/);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("fails when Stripe returns no address", async () => {
    mocks.sessionsCreate.mockResolvedValue({ url: null });
    await expect(createCheckoutSession(learner, "monthly", "cus_1")).rejects.toThrow();
  });
});

describe("ensureCustomer", () => {
  it("reuses the stored customer without calling Stripe", async () => {
    mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: "cus_stored" });
    expect(await ensureCustomer(learner)).toBe("cus_stored");
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it("creates one with an idempotency key, stores it, and returns the stored id", async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ stripeCustomerId: null }).mockResolvedValueOnce({ stripeCustomerId: "cus_new" });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
    expect(await ensureCustomer(learner)).toBe("cus_new");
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@example.com", metadata: { userId: "u1" } }),
      { idempotencyKey: "customer-u1" },
    );
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({ where: { id: "u1", stripeCustomerId: null }, data: { stripeCustomerId: "cus_new" } });
  });
});
