import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { PageFallback } from "@/components/screens/PageFallback";
import { SignInPrompt } from "@/components/watch/SignInPrompt";
import { sanitiseReturnTo } from "@/lib/auth/return-to";
import { getHost, getVideo } from "@/lib/content";
import { getLanguageBySlug, languages } from "@/lib/languages";
import { listProfiles } from "@/lib/learner/profiles";
import { languageSlugFromPathname, libraryPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

export const metadata: Metadata = { title: "Get started · Instik" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const watchPath = /^\/learn\/([^/?]+)\/watch\/([^/?]+)/;

/** Reads the query string and the session, so it renders behind a Suspense boundary. */
async function OnboardingContent({ searchParams }: { searchParams: SearchParams }) {
  const { returnTo: raw } = await searchParams;
  const returnTo = sanitiseReturnTo(raw, "") || undefined;

  // Someone who is already signed in and has a profile has nothing to set up.
  const learner = await getLearner();
  if (learner) {
    const profiles = await listProfiles(learner.id);
    if (profiles.length > 0) {
      const slug = languages.find((l) => l.code === profiles[0].languageCode)?.slug;
      redirect(returnTo ?? libraryPath(slug ?? languages[0].slug));
    }
  }

  // When they were going to a video, say which one (never show it).
  const [, videoLanguage, videoSlug] = returnTo?.match(watchPath) ?? [];
  const video = videoLanguage && videoSlug ? getVideo(videoLanguage, videoSlug) : undefined;
  const host = video ? getHost(videoLanguage, video.host) : undefined;
  const preferredSlug = returnTo ? languageSlugFromPathname(returnTo.split("?")[0]) : undefined;

  return (
    <>
      {returnTo && video && host && <SignInPrompt videoTitle={video.title} hostName={host.name} returnTo={returnTo} />}
      <OnboardingFlow
        languages={languages}
        signedIn={learner !== null}
        returnTo={returnTo}
        preferredLanguage={preferredSlug ? getLanguageBySlug(preferredSlug)?.code : undefined}
      />
    </>
  );
}

export default function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <OnboardingContent searchParams={searchParams} />
    </Suspense>
  );
}
