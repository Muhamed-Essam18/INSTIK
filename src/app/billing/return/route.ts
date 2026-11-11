import { NextResponse, type NextRequest } from "next/server";
import { hasFullAccess } from "@/lib/billing/access";
import { storedCustomerId } from "@/lib/billing/checkout";
import { syncNow } from "@/lib/billing/deps";
import { billingEnabled } from "@/lib/billing/enabled";
import { parseCheckoutSession, sessionIdSchema } from "@/lib/billing/schemas";
import { stripe } from "@/lib/billing/stripe";
import { getFreshSubscription } from "@/lib/billing/subscription";
import { pricingPath, settingsPath, signInPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

// GET /billing/return?session_id=cs_...: where Stripe Checkout sends the learner back. It asks Stripe what happened and
// brings the subscription up to date right here, so access does not wait for the webhook (which still does the same job
// if the learner closes the tab). The session must belong to the signed-in learner.

export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!billingEnabled()) return go(pricingPath());

  // Signed out: sign in and look at settings. (This address is not an allowed return address, and the webhook has done the work.)
  const learner = await getLearner();
  if (!learner) return go(signInPath(settingsPath()));

  const sessionId = sessionIdSchema.safeParse(request.nextUrl.searchParams.get("session_id"));
  if (!sessionId.success) return go(pricingPath());

  try {
    const parsed = parseCheckoutSession(await stripe().checkout.sessions.retrieve(sessionId.data));
    if (!parsed.ok) return go(pricingPath());
    const session = parsed.data;

    // Someone else's session (a guessed or shared address) changes nothing.
    const customer = await storedCustomerId(learner.id);
    const ours = session.client_reference_id === learner.id || (customer !== null && session.customer === customer);
    if (!ours) return go(pricingPath());

    if (session.subscription) await syncNow(session.subscription);

    if (hasFullAccess(await getFreshSubscription(learner.id), new Date())) return go(`${settingsPath()}?billing=success`);
    // Paid or being processed (for example a bank check): wait for it to clear. Otherwise the learner left without paying.
    if (session.status === "complete") return go(`${settingsPath()}?billing=pending`);
    return go(`${pricingPath()}?checkout=cancelled`);
  } catch {
    // Stripe could not be reached. If they did pay, the webhook will bring access on; say so calmly.
    return go(`${settingsPath()}?billing=pending`);
  }
}
