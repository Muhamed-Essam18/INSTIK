import Stripe from "stripe";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  receiveEvent: vi.fn(),
  finishEvent: vi.fn(),
  applyEvent: vi.fn(),
}));

vi.mock("@/lib/billing/store", () => ({ receiveEvent: mocks.receiveEvent, finishEvent: mocks.finishEvent }));
vi.mock("@/lib/billing/sync", () => ({ applyEvent: mocks.applyEvent }));
vi.mock("@/lib/billing/deps", () => ({ liveSyncDeps: () => ({}) }));

import { POST } from "@/app/api/stripe/webhook/route";

const secret = "whsec_route_test";
const eventJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_1" } }, ...over });

const signed = (body: string, withSecret = secret) =>
  Stripe.webhooks.generateTestHeaderString({ payload: body, secret: withSecret });

const post = (body: string, signature: string | null) =>
  POST(
    new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body,
      headers: signature ? { "stripe-signature": signature } : {},
    }),
  );

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.receiveEvent.mockResolvedValue({ firstTime: true, processed: false });
  mocks.applyEvent.mockResolvedValue({ outcome: "PROCESSED", objectId: "sub_1" });
  mocks.finishEvent.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/stripe/webhook", () => {
  it("answers 503 when the webhook secret or key is missing, and does nothing", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const body = eventJson();
    expect((await post(body, signed(body))).status).toBe(503);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect((await post(body, signed(body))).status).toBe(503);
    expect(mocks.receiveEvent).not.toHaveBeenCalled();
  });

  it("answers 400 and writes nothing for a bad signature, a missing header and a stale timestamp", async () => {
    const body = eventJson();
    expect((await post(body, signed(body, "whsec_other"))).status).toBe(400);
    expect((await post(body, null)).status).toBe(400);
    const old = Stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect((await post(body, old)).status).toBe(400);
    expect(mocks.receiveEvent).not.toHaveBeenCalled();
    expect(mocks.applyEvent).not.toHaveBeenCalled();
  });

  it("answers 400 for a body changed after signing", async () => {
    const body = eventJson();
    expect((await post(body.replace("sub_1", "sub_2"), signed(body))).status).toBe(400);
    expect(mocks.applyEvent).not.toHaveBeenCalled();
  });

  it("handles a valid event: 200, the sync runs, and the outcome is recorded", async () => {
    const body = eventJson();
    const response = await post(body, signed(body));
    expect(response.status).toBe(200);
    expect(mocks.receiveEvent).toHaveBeenCalledWith("evt_1", "customer.subscription.updated");
    expect(mocks.applyEvent).toHaveBeenCalledTimes(1);
    expect(mocks.finishEvent).toHaveBeenCalledWith("evt_1", "PROCESSED", "sub_1");
  });

  it("answers 200 and does not sync again for an event already processed", async () => {
    mocks.receiveEvent.mockResolvedValue({ firstTime: false, processed: true });
    const body = eventJson();
    expect((await post(body, signed(body))).status).toBe(200);
    expect(mocks.applyEvent).not.toHaveBeenCalled();
    expect(mocks.finishEvent).not.toHaveBeenCalled();
  });

  it("handles an event that was received before but never finished (a retry)", async () => {
    mocks.receiveEvent.mockResolvedValue({ firstTime: false, processed: false });
    const body = eventJson();
    expect((await post(body, signed(body))).status).toBe(200);
    expect(mocks.applyEvent).toHaveBeenCalledTimes(1);
  });

  it("records an unmatched event as UNMATCHED and answers 200", async () => {
    mocks.applyEvent.mockResolvedValue({ outcome: "UNMATCHED", objectId: "sub_9" });
    const body = eventJson();
    expect((await post(body, signed(body))).status).toBe(200);
    expect(mocks.finishEvent).toHaveBeenCalledWith("evt_1", "UNMATCHED", "sub_9");
  });

  it("records an event type it does not use as IGNORED and answers 200", async () => {
    mocks.applyEvent.mockResolvedValue({ outcome: "IGNORED" });
    const body = eventJson({ type: "customer.created" });
    expect((await post(body, signed(body))).status).toBe(200);
    expect(mocks.finishEvent).toHaveBeenCalledWith("evt_1", "IGNORED", undefined);
  });

  it("answers 500 and leaves the event unprocessed when the sync throws, so Stripe retries", async () => {
    mocks.applyEvent.mockRejectedValue(new Error("stripe is down"));
    const body = eventJson();
    expect((await post(body, signed(body))).status).toBe(500);
    expect(mocks.finishEvent).not.toHaveBeenCalled();
  });

  it("answers 500 when the database cannot record the event", async () => {
    mocks.receiveEvent.mockRejectedValue(new Error("db is down"));
    const body = eventJson();
    expect((await post(body, signed(body))).status).toBe(500);
    expect(mocks.applyEvent).not.toHaveBeenCalled();
  });

  it("never echoes input, the secret or an error in a response or a log line", async () => {
    mocks.applyEvent.mockRejectedValue(new Error("SECRET-ERROR-TEXT"));
    const body = eventJson({ marker: "BODY-MARKER" });
    const ok = await post(body, signed(body));
    const bad = await post(body, "garbage");
    expect(await ok.text()).toBe("");
    expect(await bad.text()).toBe("");
    const logged = JSON.stringify((console.error as ReturnType<typeof vi.fn>).mock.calls);
    expect(logged).not.toContain("SECRET-ERROR-TEXT");
    expect(logged).not.toContain("BODY-MARKER");
    expect(logged).not.toContain(secret);
  });
});
