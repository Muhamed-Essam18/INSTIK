import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/onboarding/SignInForm";
import { PageFallback } from "@/components/screens/PageFallback";
import { sanitiseReturnTo } from "@/lib/auth/return-to";
import { defaultLanguage } from "@/lib/languages";
import { libraryPath, onboardingPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in · Instik" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads the query string and the session, so it renders behind a Suspense boundary. */
async function SignInContent({ searchParams }: { searchParams: SearchParams }) {
  const { returnTo: raw } = await searchParams;
  const returnTo = sanitiseReturnTo(raw, libraryPath(defaultLanguage.slug));
  if (await getLearner()) redirect(returnTo);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Welcome back</h1>
        <p className="m-0 text-body-lg text-slate">Sign in to pick up where you left off.</p>
      </div>
      <SignInForm returnTo={returnTo} />
      <p className="m-0 text-label text-slate">
        New here?{" "}
        <Link href={onboardingPath(returnTo)} className="underline">
          Get started
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}
