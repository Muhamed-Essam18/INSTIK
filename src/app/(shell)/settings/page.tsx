import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BillingNotice } from "@/components/billing/BillingNotice";
import { PlanSection } from "@/components/billing/PlanSection";
import { PageFallback } from "@/components/screens/PageFallback";
import { ProfileList } from "@/components/settings/ProfileList";
import { hasFullAccess } from "@/lib/billing/access";
import { billingEnabled } from "@/lib/billing/enabled";
import { getSubscription } from "@/lib/billing/subscription";
import { getTimeZone, listProfiles } from "@/lib/learner/profiles";
import { addLanguagePath, settingsPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

export const metadata: Metadata = { title: "Settings · Instik", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads the session, so it renders behind a Suspense boundary. */
async function SettingsContent({ searchParams }: { searchParams: SearchParams }) {
  const learner = await requireLearner(settingsPath());
  const [profiles, subscription, timeZone, query] = await Promise.all([
    listProfiles(learner.id),
    getSubscription(learner.id),
    getTimeZone(learner.id),
    searchParams,
  ]);

  // Back from Checkout and still waiting: once access is on, swap the waiting notice for the welcome.
  if (query.billing === "pending" && hasFullAccess(subscription, new Date())) redirect(`${settingsPath()}?billing=success`);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Settings</h1>
        <p className="m-0 text-body-lg text-slate">
          Signed in as <span className="font-semibold text-ink">{learner.email}</span>
        </p>
      </div>
      <BillingNotice />
      <PlanSection subscription={subscription} timeZone={timeZone} billingOn={billingEnabled()} />
      <section aria-label="Your languages" className="flex flex-col gap-space-6">
        <ProfileList profiles={profiles} />
        <Link
          href={addLanguagePath()}
          className="inline-flex min-h-11 items-center self-start text-label underline"
        >
          Add a language
        </Link>
      </section>
    </div>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}
