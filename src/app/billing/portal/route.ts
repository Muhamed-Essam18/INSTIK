import { NextResponse, type NextRequest } from "next/server";
import { createPortalSession } from "@/lib/billing/checkout";
import { billingEnabled } from "@/lib/billing/enabled";
import { pricingPath, settingsPath, signInPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

// GET /billing/portal[?flow=cancel]: sends the learner to Stripe's Customer Portal, where they update their card, see
// invoices, cancel (at the end of the paid period), resume, or switch period. `flow=cancel` opens on the cancel confirmation.

export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!billingEnabled()) return go(pricingPath());

  // Signed out: sign in and look at settings (this address is not an allowed return address).
  const learner = await getLearner();
  if (!learner) return go(signInPath(settingsPath()));

  // Only the one known flow is accepted; anything else opens the plain portal.
  const flow = request.nextUrl.searchParams.get("flow") === "cancel" ? "cancel" : undefined;

  try {
    const url = await createPortalSession(learner, flow);
    return url ? NextResponse.redirect(url, 303) : go(pricingPath()); // no Stripe customer yet: nothing to manage
  } catch {
    return go(`${settingsPath()}?billing=unavailable`);
  }
}
