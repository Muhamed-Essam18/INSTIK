import { NextResponse, type NextRequest } from "next/server";
import { createCheckoutSession, ensureCustomer, findOpenSubscription } from "@/lib/billing/checkout";
import { hasFullAccess } from "@/lib/billing/access";
import { syncNow } from "@/lib/billing/deps";
import { billingEnabled } from "@/lib/billing/enabled";
import { periodSchema } from "@/lib/billing/schemas";
import { getSubscription } from "@/lib/billing/subscription";
import { billingStartPath, onboardingPath, pricingPath, settingsPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

// GET /billing/start?period=monthly|yearly: sends the learner to Stripe Checkout for that period.
// Creating a Checkout Session is not a charge; the learner still enters and confirms payment on Stripe's page.

export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (!billingEnabled()) return go(pricingPath());

  const period = periodSchema.safeParse(request.nextUrl.searchParams.get("period"));
  if (!period.success) return go(pricingPath());

  // A signed-out visitor signs up first and comes back to this address, with the same period.
  const learner = await getLearner();
  if (!learner) return go(onboardingPath(billingStartPath(period.data)));

  if (hasFullAccess(await getSubscription(learner.id), new Date())) return go(settingsPath());

  try {
    const customerId = await ensureCustomer(learner);
    // Never a second subscription: if Stripe lists one that has not ended, bring it up to date and go to settings.
    const open = await findOpenSubscription(customerId);
    if (open) {
      await syncNow(open.id).catch(() => undefined);
      return go(settingsPath());
    }
    return NextResponse.redirect(await createCheckoutSession(learner, period.data, customerId), 303);
  } catch {
    return go(`${pricingPath()}?checkout=unavailable`);
  }
}
