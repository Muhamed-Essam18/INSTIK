import type { Metadata } from "next";
import { Suspense } from "react";
import { UploadForm } from "@/components/creator/UploadForm";
import { PageFallback } from "@/components/screens/PageFallback";
import { getOwnProfile } from "@/lib/content/creator-reads";
import { getLanguageByCode } from "@/lib/languages";
import { languageName } from "@/lib/language-name";
import { uploadsEnabled } from "@/lib/mux/client";
import { creatorUploadPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

export const metadata: Metadata = { title: "Upload a video · Instik creator", robots: { index: false } };

async function UploadScreen() {
  const actor = await requireCreator(creatorUploadPath());
  const profile = await getOwnProfile(actor);
  const language = profile ? getLanguageByCode(profile.languageCode) : undefined;
  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Upload a video</h1>
        <p className="m-0 text-body-lg text-slate">
          {language ? languageName(language) : "Your language"} · reviewed by Instik before it goes live
        </p>
      </div>
      <UploadForm
        fileStep="uploader"
        languageLabel={language ? languageName(language) : "Not set yet"}
        hostComplete={profile?.complete ?? false}
        uploadsEnabled={uploadsEnabled()}
      />
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <UploadScreen />
    </Suspense>
  );
}
