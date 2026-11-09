import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { startDestination } from "@/lib/marketing/start-destination";
import { defaultLanguage } from "@/lib/languages";
import { onboardingPath } from "@/lib/routes";
import { getLearner } from "@/lib/session";

type Props = { className: string; children: ReactNode };

/** Reads the session, so it renders behind Suspense: onboarding for a visitor, the library for a signed-in learner. */
async function StartLink({ className, children }: Props) {
  const learner = await getLearner();
  return (
    <Link href={startDestination(learner, defaultLanguage.slug)} className={className}>
      {children}
    </Link>
  );
}

/** A call to action. The fallback (also what the page is prerendered with) is the signed-out link to onboarding. */
export function StartCta({ className, children }: Props) {
  return (
    <Suspense
      fallback={
        <Link href={onboardingPath()} className={className}>
          {children}
        </Link>
      }
    >
      <StartLink className={className}>{children}</StartLink>
    </Suspense>
  );
}
