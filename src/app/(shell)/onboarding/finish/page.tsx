import type { Metadata } from "next";
import { Suspense } from "react";
import { FinishOnboarding } from "@/components/onboarding/FinishOnboarding";
import { PageFallback } from "@/components/screens/PageFallback";
import { sanitiseReturnTo } from "@/lib/auth/return-to";
import { languages } from "@/lib/languages";
import { listProfiles } from "@/lib/learner/profiles";
import { onboardingFinishPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

export const metadata: Metadata = { title: "Setting things up · Instik", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function FinishContent({ searchParams }: { searchParams: SearchParams }) {
  const { returnTo: raw } = await searchParams;
  const returnTo = sanitiseReturnTo(raw, "") || undefined;
  const learner = await requireLearner(onboardingFinishPath(returnTo));
  const profiles = await listProfiles(learner.id);
  return (
    <div className="mx-auto max-w-[720px]">
      <FinishOnboarding languages={languages} existingCodes={profiles.map((p) => p.languageCode)} returnTo={returnTo} />
    </div>
  );
}

export default function FinishOnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FinishContent searchParams={searchParams} />
    </Suspense>
  );
}
