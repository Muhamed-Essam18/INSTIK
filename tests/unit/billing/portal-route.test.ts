import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billingEnabled: vi.fn(),
  getLearner: vi.fn(),
  storedCustomerId: vi.fn(),
  getFreshSubscription: vi.fn(),
  portalCreate: vi.fn(),
}));

vi.mock("@/lib/billing/enabled", () => ({ billingEnabled: mocks.billingEnabled }));
vi.mock("@/lib/session", () => ({ getLearner: mocks.getLearner }));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: async () => ({ stripeCustomerId: await mocks.storedCustomerId() }) } }) }));
vi.mock("@/lib/billing/subscription", () => ({ getFreshSubscription: mocks.getFreshSubscription }));
vi.mock("@/lib/billing/stripe", () => ({
  siteOrigin: () => "https://instik.example",
  stripe: () => ({ billingPortal: { sessions: { create: mocks.portalCreate } } }),
}));

import { GET } from "@/app/billing/portal/route";

const learner = { id: "u1", email: "a@example.com", name: null, image: null };
const call = (query = "") => GET(new NextRequest(`http://localhost:3000/billing/portal${query}`));
const where = (response: Response) => response.headers.get("location")!.replace("http://localhost:3000", "");

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.billingEnabled.mockReturnValue(true);
  mocks.getLearner.mockResolvedValue(learner);
  mocks.storedCustomerId.mockResolvedValue("cus_1");
  mocks.getFreshSubscription.mockResolvedValue({ stripeSubscriptionId: "sub_1", status: "ACTIVE" });
  mocks.portalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session/x" });
});

describe("GET /billing/portal", () => {
  it("goes to pricing while billing is off", async () => {
    mocks.billingEnabled.mockReturnValue(false);
    expect(where(await call())).toBe("/pricing");
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in with settings as the place to land", async () => {
    mocks.getLearner.mockResolvedValue(null);
    expect(where(await call())).toBe("/sign-in?returnTo=%2Fsettings");
  });

  it("goes to pricing when the learner has no Stripe customer", async () => {
    mocks.storedCustomerId.mockResolvedValue(null);
    expect(where(await call())).toBe("/pricing");
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("opens a plain portal session that returns to settings", async () => {
    const response = await call();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://billing.stripe.com/p/session/x");
    expect(mocks.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://instik.example/settings" });
  });

  it("opens on the cancellation confirmation for the learner's subscription with flow=cancel", async () => {
    await call("?flow=cancel");
    expect(mocks.portalCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://instik.example/settings",
      flow_data: { type: "subscription_cancel", subscription_cancel: { subscription: "sub_1" } },
    });
  });

  it("opens the plain portal for flow=cancel when there is no subscription", async () => {
    mocks.getFreshSubscription.mockResolvedValue(null);
    await call("?flow=cancel");
    expect(mocks.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://instik.example/settings" });
  });

  it("ignores an unknown flow", async () => {
    await call("?flow=delete-everything");
    expect(mocks.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://instik.example/settings" });
  });

  it("sends a Stripe error back to settings with the calm notice", async () => {
    mocks.portalCreate.mockRejectedValue(new Error("stripe is down"));
    expect(where(await call())).toBe("/settings?billing=unavailable");
  });
});
