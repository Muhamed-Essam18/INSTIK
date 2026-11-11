import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { TOLERANCE_SECONDS, verifyEvent, WebhookVerificationError } from "@/lib/billing/webhook";

const secret = "whsec_test_secret";
const payload = JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
const now = new Date("2026-11-09T12:00:00Z");
const nowSeconds = Math.floor(now.getTime() / 1000);

const header = (over: { payload?: string; secret?: string; timestamp?: number } = {}) =>
  Stripe.webhooks.generateTestHeaderString({
    payload: over.payload ?? payload,
    secret: over.secret ?? secret,
    timestamp: over.timestamp ?? nowSeconds,
  });

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof WebhookVerificationError) return error.code;
    throw error;
  }
  return "no error";
};

describe("verifyEvent", () => {
  it("returns the event for a valid signature", () => {
    const event = verifyEvent(payload, header(), secret, now);
    expect(event.id).toBe("evt_1");
    expect(event.type).toBe("customer.subscription.updated");
  });

  it("refuses a payload changed after signing", () => {
    const tampered = payload.replace("sub_1", "sub_2");
    expect(codeOf(() => verifyEvent(tampered, header(), secret, now))).toBe("bad-signature");
  });

  it("refuses a body signed with another secret", () => {
    expect(codeOf(() => verifyEvent(payload, header({ secret: "whsec_other" }), secret, now))).toBe("bad-signature");
  });

  it("refuses a missing header", () => {
    expect(codeOf(() => verifyEvent(payload, null, secret, now))).toBe("missing-signature");
    expect(codeOf(() => verifyEvent(payload, undefined, secret, now))).toBe("missing-signature");
    expect(codeOf(() => verifyEvent(payload, "", secret, now))).toBe("missing-signature");
  });

  it("refuses a malformed header", () => {
    expect(codeOf(() => verifyEvent(payload, "garbage", secret, now))).toBe("bad-signature");
    expect(codeOf(() => verifyEvent(payload, "t=abc,v1=", secret, now))).toBe("bad-signature");
  });

  it("refuses a timestamp older than the tolerance, and accepts one just inside it", () => {
    const old = header({ timestamp: nowSeconds - TOLERANCE_SECONDS - 60 });
    expect(codeOf(() => verifyEvent(payload, old, secret, now))).toBe("stale-timestamp");
    const inside = header({ timestamp: nowSeconds - TOLERANCE_SECONDS + 30 });
    expect(codeOf(() => verifyEvent(payload, inside, secret, now))).toBe("no error");
  });

  it("refuses an empty secret, so a missing setting can never accept everything", () => {
    expect(codeOf(() => verifyEvent(payload, header(), "", now))).toBe("bad-signature");
  });

  it("refuses a correctly signed body that is not an event", () => {
    const notJson = "not json";
    expect(codeOf(() => verifyEvent(notJson, header({ payload: notJson }), secret, now))).toBe("bad-payload");
  });

  it("carries the reason only, never the body or the secret", () => {
    try {
      verifyEvent(payload, "garbage", secret, now);
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain("sub_1");
    }
  });
});
