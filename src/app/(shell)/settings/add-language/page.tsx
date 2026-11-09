import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { AddLanguageFlow } from "@/components/settings/AddLanguageFlow";
import { sanitiseReturnTo } from "@/lib/auth/return-to";
import { languages } from "@/lib/languages";
import { languagesToOffer } from "@/lib/learner/profile-rules";
import { listProfiles } from "@/lib/learner/profiles";
import { addLanguagePath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

export const metadata: Metadata = { title: "Add a language · Instik", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function AddLanguageContent({ searchParams }: { searchParams: SearchParams }) {
  const { language, returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitiseReturnTo(rawReturnTo, "") || undefined;
  const preselected = typeof language === "string" ? language : undefined;
  const learner = await requireLearner(addLanguagePath(preselected, returnTo));
  const offers = languagesToOffer(languages, await listProfiles(learner.id));
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Add a language</h1>
        <p className="m-0 text-body-lg text-slate">Each language has its own settings, so changing one never changes another.</p>
      </div>
      <AddLanguageFlow offers={offers} preselected={preselected} returnTo={returnTo} />
    </div>
  );
}

export default function AddLanguagePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AddLanguageContent searchParams={searchParams} />
    </Suspense>
  );
}
