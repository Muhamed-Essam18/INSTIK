import "server-only";
import Stripe from "stripe";

// Signature verification for Stripe webhooks. Nothing from the body is trusted, or even parsed, until this passes.

export type WebhookFailure = "missing-signature" | "bad-signature" | "stale-timestamp" | "bad-payload";

/** Thrown when an incoming webhook is not verifiably from Stripe. The message names the reason only, never the input. */
export class WebhookVerificationError extends Error {
  constructor(readonly code: WebhookFailure) {
    super(`Webhook verification failed: ${code}`);
    this.name = "WebhookVerificationError";
  }
}

/** Five minutes, Stripe's default: an old signed body cannot be replayed later. */
export const TOLERANCE_SECONDS = 300;

/** The event types the billing code acts on. Anything else is recorded as ignored. */
export const relevantEventTypes = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

/**
 * Checks the `stripe-signature` header against the raw body (HMAC-SHA256 over `timestamp.body`, constant-time compare,
 * five-minute tolerance) and returns the event. Throws a `WebhookVerificationError` otherwise.
 */
export function verifyEvent(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
  now: Date = new Date(),
): Stripe.Event {
  if (!secret) throw new WebhookVerificationError("bad-signature");
  if (!signature) throw new WebhookVerificationError("missing-signature");
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret, TOLERANCE_SECONDS, undefined, now.getTime());
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/tolerance/i.test(message)) throw new WebhookVerificationError("stale-timestamp");
    // A correctly signed body that is not JSON is the only case that reaches the parser; every other failure is a signature problem.
    if (error instanceof SyntaxError) throw new WebhookVerificationError("bad-payload");
    throw new WebhookVerificationError("bad-signature");
  }
}
