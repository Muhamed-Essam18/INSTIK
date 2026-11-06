import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/onboarding/SignInForm";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Sign in · Instik" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Short, kind messages for what Auth.js reports. None of them says whether an address has an account. */
function messageFor(error: string | undefined): string {
  if (error === "Verification") return "That link has been used or has run out. Ask for a new one.";
  if (error && (error.startsWith("OAuth") || error === "AccessDenied" || error === "Callback")) {
    return "We couldn't sign you in with Google. Try again, or use an email link.";
  }
  return "Something went wrong signing you in. Please try again.";
}

async function ErrorContent({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Let&apos;s try that again</h1>
        <p role="alert" className="m-0 text-body-lg text-slate">
          {messageFor(typeof error === "string" ? error : undefined)}
        </p>
      </div>
      <SignInForm />
    </div>
  );
}

export default function SignInErrorPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ErrorContent searchParams={searchParams} />
    </Suspense>
  );
}
