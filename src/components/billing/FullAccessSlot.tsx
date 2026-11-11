import Link from "next/link";
import { Suspense } from "react";
import { FullAccessAction } from "@/components/billing/FullAccessAction";
import { StartCta } from "@/components/marketing/StartLink";
import { coralButton, inkButton } from "@/components/marketing/buttons";
import { hasFullAccess } from "@/lib/billing/access";
import { billingEnabled } from "@/lib/billing/enabled";
import { getSubscription } from "@/lib/billing/subscription";
import { pricing } from "@/lib/marketing/copy";
import { onboardingPath, settingsPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

const shape = "h-[52px] w-full text-[16px]";

/** The session-aware part of the Full access card. Reads the session, so the pricing page renders it behind Suspense. */
async function Slot() {
  // Billing off (placeholder prices or no Stripe settings): the button behaves as before, onboarding or the library.
  if (!billingEnabled()) return <StartCta className={`${coralButton} ${shape}`}>{pricing.full.cta}</StartCta>;

  const learner = await getLearner();
  if (learner && hasFullAccess(await getSubscription(learner.id), new Date())) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-center text-body font-semibold">You have Full access.</p>
        <Link href={settingsPath()} className={`${inkButton} ${shape} border border-cream`}>
          Manage your plan
        </Link>
      </div>
    );
  }
  return <FullAccessAction />;
}

/** The Full access button area: the signed-out, billing-off link to onboarding is what the page is prerendered with. */
export function FullAccessSlot() {
  return (
    <Suspense
      fallback={
        <Link href={onboardingPath()} className={`${coralButton} ${shape}`}>
          {pricing.full.cta}
        </Link>
      }
    >
      <Slot />
    </Suspense>
  );
}
