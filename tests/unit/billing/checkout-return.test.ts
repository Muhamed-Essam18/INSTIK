import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutSessionFixture } from "../../helpers/stripe-fixtures";

const mocks = vi.hoisted(() => ({
  billingEnabled: vi.fn(),
  getLearner: vi.fn(),
  storedCustomerId: vi.fn(),
  retrieve: vi.fn(),
  syncNow: vi.fn(),
  getFreshSubscription: vi.fn(),
}));

vi.mock("@/lib/billing/enabled", () => ({ billingEnabled: mocks.billingEnabled }));
vi.mock("@/lib/session", () => ({ getLearner: mocks.getLearner }));
vi.mock("@/lib/billing/checkout", () => ({ storedCustomerId: mocks.storedCustomerId }));
vi.mock("@/lib/billing/stripe", () => ({ stripe: () => ({ checkout: { sessions: { retrieve: mocks.retrieve } } }) }));
vi.mock("@/lib/billing/deps", () => ({ syncNow: mocks.syncNow }));
vi.mock("@/lib/billing/subscription", () => ({ getFreshSubscription: mocks.getFreshSubscription }));

import { GET } from "@/app/billing/return/route";

const learner = { id: "user-a", email: "a@example.com", name: null, image: null };
const call = (query = "?session_id=cs_test_1") => GET(new NextRequest(`http://localhost:3000/billing/return${query}`));
const where = (response: Response) => response.headers.get("location")!.replace("http://localhost:3000", "");
const active = { status: "ACTIVE", plan: "MONTHLY", currentPeriodEnd: new Date(Date.now() + 86_400_000), cancelAtPeriodEnd: false };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.billingEnabled.mockReturnValue(true);
  mocks.getLearner.mockResolvedValue(learner);
  mocks.storedCustomerId.mockResolvedValue("cus_1");
  mocks.retrieve.mockResolvedValue(checkoutSessionFixture());
  mocks.syncNow.mockResolvedValue({ outcome: "applied", userId: "user-a" });
  mocks.getFreshSubscription.mockResolvedValue(active);
});

describe("GET /billing/return", () => {
  it("goes to pricing and calls nothing while billing is off", async () => {
    mocks.billingEnabled.mockReturnValue(false);
    expect(where(await call())).toBe("/pricing");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in, with settings as the place to land", async () => {
    mocks.getLearner.mockResolvedValue(null);
    expect(where(await call())).toBe("/sign-in?returnTo=%2Fsettings");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it.each(["", "?session_id=", "?session_id=abc", "?session_id=cs_x/../y", "?session_id=sub_123"])(
    "sends a malformed session_id %j to pricing without calling Stripe",
    async (query) => {
      expect(where(await call(query))).toBe("/pricing");
      expect(mocks.retrieve).not.toHaveBeenCalled();
    },
  );

  it("refuses another learner's session: nothing is synced", async () => {
    mocks.retrieve.mockResolvedValue(checkoutSessionFixture({ client_reference_id: "someone-else", customer: "cus_other" }));
    expect(where(await call())).toBe("/pricing");
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("accepts a session matched by the learner's stored customer", async () => {
    mocks.retrieve.mockResolvedValue(checkoutSessionFixture({ client_reference_id: null, customer: "cus_1" }));
    expect(where(await call())).toBe("/settings?billing=success");
  });

  it("does not match a session when the learner has no stored customer and another reference", async () => {
    mocks.storedCustomerId.mockResolvedValue(null);
    mocks.retrieve.mockResolvedValue(checkoutSessionFixture({ client_reference_id: "someone-else", customer: null }));
    expect(where(await call())).toBe("/pricing");
  });

  it("syncs a paid session and goes to the success notice", async () => {
    expect(where(await call())).toBe("/settings?billing=success");
    expect(mocks.syncNow).toHaveBeenCalledWith("sub_1");
  });

  it("goes to the waiting notice when the payment is still being processed", async () => {
    mocks.getFreshSubscription.mockResolvedValue({ ...active, status: "INCOMPLETE" });
    expect(where(await call())).toBe("/settings?billing=pending");
  });

  it("goes to the cancelled notice when the learner left without paying", async () => {
    mocks.retrieve.mockResolvedValue(checkoutSessionFixture({ status: "open", payment_status: "unpaid", subscription: null }));
    mocks.getFreshSubscription.mockResolvedValue(null);
    expect(where(await call())).toBe("/pricing?checkout=cancelled");
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("goes to the cancelled notice for an expired session", async () => {
    mocks.retrieve.mockResolvedValue(checkoutSessionFixture({ status: "expired", subscription: null }));
    mocks.getFreshSubscription.mockResolvedValue(null);
    expect(where(await call())).toBe("/pricing?checkout=cancelled");
  });

  it("sends a session that does not parse to pricing", async () => {
    mocks.retrieve.mockResolvedValue({ nope: true });
    expect(where(await call())).toBe("/pricing");
  });

  it("goes to the waiting notice when Stripe cannot be reached (the webhook will bring access on)", async () => {
    mocks.retrieve.mockRejectedValue(new Error("stripe is down"));
    expect(where(await call())).toBe("/settings?billing=pending");
  });
});
