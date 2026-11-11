import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billingEnabled: vi.fn(),
  getLearner: vi.fn(),
  getSubscription: vi.fn(),
  ensureCustomer: vi.fn(),
  findOpenSubscription: vi.fn(),
  createCheckoutSession: vi.fn(),
  syncNow: vi.fn(),
}));

vi.mock("@/lib/billing/enabled", () => ({ billingEnabled: mocks.billingEnabled }));
vi.mock("@/lib/session", () => ({ getLearner: mocks.getLearner }));
vi.mock("@/lib/billing/subscription", () => ({ getSubscription: mocks.getSubscription }));
vi.mock("@/lib/billing/checkout", () => ({
  ensureCustomer: mocks.ensureCustomer,
  findOpenSubscription: mocks.findOpenSubscription,
  createCheckoutSession: mocks.createCheckoutSession,
}));
vi.mock("@/lib/billing/deps", () => ({ syncNow: mocks.syncNow }));

import { GET } from "@/app/billing/start/route";

const learner = { id: "u1", email: "a@example.com", name: null, image: null };
const call = (query = "?period=yearly") => GET(new NextRequest(`http://localhost:3000/billing/start${query}`));
const where = (response: Response) => {
  const location = response.headers.get("location")!;
  return location.startsWith("http://localhost:3000") ? location.slice("http://localhost:3000".length) : location;
};
const activeRow = { status: "ACTIVE", plan: "MONTHLY", currentPeriodEnd: new Date(Date.now() + 86_400_000), cancelAtPeriodEnd: false };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.billingEnabled.mockReturnValue(true);
  mocks.getLearner.mockResolvedValue(learner);
  mocks.getSubscription.mockResolvedValue(null);
  mocks.ensureCustomer.mockResolvedValue("cus_1");
  mocks.findOpenSubscription.mockResolvedValue(null);
  mocks.createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/c/pay/cs_test_1");
  mocks.syncNow.mockResolvedValue({ outcome: "applied", userId: "u1" });
});

describe("GET /billing/start", () => {
  it("goes to pricing and calls nothing while billing is off", async () => {
    mocks.billingEnabled.mockReturnValue(false);
    const response = await call();
    expect(response.status).toBe(303);
    expect(where(response)).toBe("/pricing");
    expect(mocks.getLearner).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each(["", "?period=weekly", "?period=", "?period=YEARLY", "?period=yearly%20"])("sends %j back to pricing", async (query) => {
    expect(where(await call(query))).toBe("/pricing");
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to onboarding with this address, keeping the period, and calls Stripe not at all", async () => {
    mocks.getLearner.mockResolvedValue(null);
    expect(where(await call("?period=yearly"))).toBe("/onboarding?returnTo=%2Fbilling%2Fstart%3Fperiod%3Dyearly");
    expect(mocks.ensureCustomer).not.toHaveBeenCalled();
  });

  it("sends a learner who already has access to settings", async () => {
    mocks.getSubscription.mockResolvedValue(activeRow);
    expect(where(await call())).toBe("/settings");
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("syncs a subscription Stripe still lists and goes to settings, without a new session", async () => {
    mocks.findOpenSubscription.mockResolvedValue({ id: "sub_9", status: "active" });
    expect(where(await call())).toBe("/settings");
    expect(mocks.syncNow).toHaveBeenCalledWith("sub_9");
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("redirects to the Checkout address for the chosen period", async () => {
    const response = await call("?period=monthly");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(learner, "monthly", "cus_1");
  });

  it("passes only the period from the request: no amount or price id can be supplied", async () => {
    await call("?period=yearly&amount=1&price=price_evil&customer=cus_evil");
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(learner, "yearly", "cus_1");
    expect(mocks.ensureCustomer).toHaveBeenCalledWith(learner);
  });

  it("sends a Stripe error back to pricing with the calm notice", async () => {
    mocks.createCheckoutSession.mockRejectedValue(new Error("stripe is down"));
    expect(where(await call())).toBe("/pricing?checkout=unavailable");
  });

  it("goes to settings even if bringing the open subscription up to date fails", async () => {
    mocks.findOpenSubscription.mockResolvedValue({ id: "sub_9", status: "past_due" });
    mocks.syncNow.mockRejectedValue(new Error("stripe is down"));
    expect(where(await call())).toBe("/settings");
  });
});
