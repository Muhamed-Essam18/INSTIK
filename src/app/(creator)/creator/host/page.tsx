import type { Metadata } from "next";
import { Suspense } from "react";
import { HostForm } from "@/components/creator/HostForm";
import { PageFallback } from "@/components/screens/PageFallback";
import { getOwnProfile } from "@/lib/content/creator-reads";
import { photosEnabled } from "@/lib/creator/photo-store";
import { getLanguageByCode } from "@/lib/languages";
import { creatorHostPath, hostPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

export const metadata: Metadata = { title: "My host page · Instik creator", robots: { index: false } };

async function HostScreen() {
  const actor = await requireCreator(creatorHostPath());
  const profile = await getOwnProfile(actor);
  const language = profile ? getLanguageByCode(profile.languageCode) : undefined;
  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">My host page</h1>
        <p className="m-0 text-body-lg text-slate">This is what learners see next to your videos.</p>
      </div>
      {profile && language ? (
        <HostForm
          host={{ name: profile.name, nameArabic: profile.nameArabic, story: profile.story, topics: profile.topics, photo: profile.photo }}
          photosEnabled={photosEnabled()}
          publicHref={hostPath(language.slug, profile.slug)}
        />
      ) : (
        <p className="m-0 text-body text-ink">We couldn&apos;t find your host page. Please contact Instik.</p>
      )}
    </div>
  );
}

export default function HostPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <HostScreen />
    </Suspense>
  );
}
