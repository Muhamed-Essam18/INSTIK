import Link from "next/link";
import { coralButton } from "@/components/marketing/buttons";
import { periodLabel, priceLabel, type Period } from "@/lib/billing/plans";
import { planDisplay, type BillingPlanName } from "@/lib/billing/status";
import type { SubscriptionFacts } from "@/lib/billing/access";
import { billingPortalPath, pricingPath } from "@/lib/routes";

type Props = {
  subscription: (SubscriptionFacts & { plan: BillingPlanName }) | null;
  /** The learner's IANA time zone, for the dates. */
  timeZone?: string | null;
  /** False while billing is off (placeholder prices or no Stripe settings): the state is shown, but no links to Stripe. */
  billingOn: boolean;
  /**
   * Whether learners can change between monthly and yearly yet. Off until the in-app switch exists (tasks.md T074):
   * Stripe's portal cannot defer that change to the end of the period, so the sentence about it would promise a control that is not there.
   */
  canSwitchPlan?: boolean;
  now?: Date;
};

const link = "inline-flex min-h-11 items-center text-label underline";
const calmButton = `${coralButton} min-h-12 px-[22px] text-[15px]`;

/** "Your plan" on the settings page: Free, Full access (active, ending, past due) or ended. Calm and specific, never urgent. */
export function PlanSection({ subscription, timeZone, billingOn, canSwitchPlan = false, now = new Date() }: Props) {
  const plan = planDisplay(subscription, now, timeZone);

  return (
    <section aria-label="Your plan" className="flex flex-col gap-space-4 rounded-lg bg-paper p-space-6">
      <h2 className="m-0 font-display text-heading text-ink">Your plan</h2>

      {plan.state === "free" || plan.state === "ended" ? (
        <>
          <p className="m-0 text-body text-ink">
            You&apos;re on <span className="font-semibold">Free</span>. Your hours and roadmap are exactly as you left them.
          </p>
          <Link href={pricingPath()} className={`${calmButton} self-start`}>
            See Full access
          </Link>
        </>
      ) : (
        <ActivePlan plan={plan} billingOn={billingOn} canSwitchPlan={canSwitchPlan} />
      )}
    </section>
  );
}

function ActivePlan({
  plan,
  billingOn,
  canSwitchPlan,
}: {
  plan: Extract<ReturnType<typeof planDisplay>, { dateLabel: string }>;
  billingOn: boolean;
  canSwitchPlan: boolean;
}) {
  const period: Period = plan.plan === "YEARLY" ? "yearly" : "monthly";
  return (
    <>
      <p className="m-0 text-body text-ink">
        <span className="font-semibold">Full access</span> · {plan.plan === "YEARLY" ? "Yearly" : "Monthly"} · {priceLabel(period)}{" "}
        {periodLabel(period)}
      </p>

      {plan.state === "active" ? (
        <>
          <p className="m-0 text-body text-slate">Renews on {plan.dateLabel}.</p>
          {canSwitchPlan ? (
            <p className="m-0 text-label font-normal text-slate">
              Changing between monthly and yearly takes effect when your current period ends.
            </p>
          ) : null}
        </>
      ) : null}

      {plan.state === "ending" ? (
        <p className="m-0 text-body text-ink">Full access until {plan.dateLabel}. Your hours stay with you.</p>
      ) : null}

      {plan.state === "past-due" ? (
        <p className="m-0 text-body text-ink">
          We couldn&apos;t take your last payment. You still have access while we try again. You can update your card any time.
        </p>
      ) : null}

      {billingOn ? (
        <div className="flex flex-wrap items-center gap-x-space-6 gap-y-space-2">
          {plan.state === "active" ? (
            <>
              <Link href={billingPortalPath()} className={link}>
                Manage payment and invoices
              </Link>
              <Link href={billingPortalPath("cancel")} className={link}>
                Cancel subscription
              </Link>
            </>
          ) : null}
          {plan.state === "ending" ? (
            <Link href={billingPortalPath()} className={calmButton}>
              Resume
            </Link>
          ) : null}
          {plan.state === "past-due" ? (
            <Link href={billingPortalPath()} className={calmButton}>
              Update payment details
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
