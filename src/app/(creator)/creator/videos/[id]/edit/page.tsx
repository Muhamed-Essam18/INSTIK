import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { UploadForm } from "@/components/creator/UploadForm";
import { PageFallback } from "@/components/screens/PageFallback";
import { getOwnProfile, getOwnVideo } from "@/lib/content/creator-reads";
import { canEditDetails, displayStatus } from "@/lib/creator/rules";
import { getLanguageByCode } from "@/lib/languages";
import { languageName } from "@/lib/language-name";
import { uploadsEnabled } from "@/lib/mux/client";
import { creatorVideoEditPath, creatorVideoPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

export const metadata: Metadata = { title: "Edit video · Instik creator", robots: { index: false } };

async function EditScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireCreator(creatorVideoEditPath(id));
  const video = await getOwnVideo(actor, id);
  if (!video) notFound(); // another creator's video, a deleted one and a missing one all look the same
  // Videos that are in review, approved or rejected cannot be edited: back to their status page.
  if (!canEditDetails(video)) redirect(creatorVideoPath(video.id));
  const profile = await getOwnProfile(actor);
  const language = getLanguageByCode(video.languageCode);
  const display = displayStatus(video, new Date());
  const fileStep =
    video.status === "CHANGES_REQUESTED" ? "none" : display.key === "draft" || display.key === "upload-unfinished" ? "uploader" : "in-flight";
  const fileNote =
    display.key === "ready-to-submit"
      ? "Your video file is uploaded and processed. Check the details below, then submit."
      : "Your video file is uploading or processing. You can fill in the details meanwhile.";
  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">{video.title || "Untitled video"}</h1>
        <p className="m-0 text-body-lg text-slate">{display.label}</p>
      </div>
      <UploadForm
        video={{ id: video.id, title: video.title, description: video.description, proposedStage: video.proposedStage, topic: video.topic }}
        fileStep={fileStep}
        fileNote={fileNote}
        languageLabel={language ? languageName(language) : video.languageCode}
        hostComplete={profile?.complete ?? false}
        uploadsEnabled={uploadsEnabled()}
      />
    </div>
  );
}

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditScreen params={params} />
    </Suspense>
  );
}
