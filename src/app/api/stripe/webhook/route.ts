import { liveSyncDeps } from "@/lib/billing/deps";
import { finishEvent, receiveEvent } from "@/lib/billing/store";
import { applyEvent } from "@/lib/billing/sync";
import { verifyEvent, WebhookVerificationError } from "@/lib/billing/webhook";

// POST /api/stripe/webhook: called only by Stripe. Verify the signature on the raw body first; then record the
// delivery (so a repeat is recognised), bring our subscription row up to date from Stripe, and answer.
// Responses carry no body: nothing from the request, the secret or an error is ever echoed.

const reply = (status: number) => new Response(null, { status });

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return reply(503);

  const rawBody = await request.text(); // the exact bytes Stripe signed; never request.json() before verifying
  let event;
  try {
    event = verifyEvent(rawBody, request.headers.get("stripe-signature"), secret);
  } catch (error) {
    if (!(error instanceof WebhookVerificationError)) console.error("[billing] webhook verification crashed");
    return reply(400);
  }

  try {
    const received = await receiveEvent(event.id, event.type);
    // Already handled: Stripe retried or sent it twice. Nothing to do.
    if (!received.firstTime && received.processed) return reply(200);

    const result = await applyEvent(event, liveSyncDeps());
    await finishEvent(event.id, result.outcome, result.objectId);
    return reply(200);
  } catch {
    // Left unprocessed so Stripe retries; the log line carries the event id and type only.
    console.error("[billing] webhook processing failed", { event: event.id, type: event.type });
    return reply(500);
  }
}
