import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { ProfileList } from "@/components/settings/ProfileList";
import { listProfiles } from "@/lib/learner/profiles";
import { addLanguagePath, settingsPath } from "@/lib/routes";
import { requireLearner } from "@/lib/session";

export const metadata: Metadata = { title: "Settings · Instik", robots: { index: false } };

/** Reads the session, so it renders behind a Suspense boundary. */
async function SettingsContent() {
  const learner = await requireLearner(settingsPath());
  const profiles = await listProfiles(learner.id);
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Settings</h1>
        <p className="m-0 text-body-lg text-slate">
          Signed in as <span className="font-semibold text-ink">{learner.email}</span>
        </p>
      </div>
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

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <SettingsContent />
    </Suspense>
  );
}
