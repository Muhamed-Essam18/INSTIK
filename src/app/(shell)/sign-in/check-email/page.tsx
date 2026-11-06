import type { Metadata } from "next";
import { ResendLink } from "@/components/onboarding/ResendLink";

export const metadata: Metadata = { title: "Check your email · Instik" };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-6">
      <h1 className="m-0 font-display text-title text-ink">Check your email</h1>
      <p className="m-0 text-body-lg text-slate">We&apos;ve sent a sign-in link. It works once and lasts an hour.</p>
      <ResendLink />
    </div>
  );
}
