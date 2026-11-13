import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreatorPreview } from "@/components/creator/CreatorPreview";
import { DeleteDraft } from "@/components/creator/DeleteDraft";
import { HistoryList } from "@/components/creator/HistoryList";
import { StatusBadge } from "@/components/creator/StatusBadge";
import { VersionUpload } from "@/components/creator/VersionUpload";
import { PageFallback } from "@/components/screens/PageFallback";
import { getOwnPlayback, getOwnVideo, listStatusHistory } from "@/lib/content/creator-reads";
import { stageLabel, stages, topicLabel, topics, type StageSlug, type TopicSlug } from "@/lib/content/taxonomy";
import { historyItems } from "@/lib/creator/list";
import { canDelete, canEditDetails, canUploadNewVersion, displayStatus } from "@/lib/creator/rules";
import { signPlaybackTokens } from "@/lib/billing/playback";
import { uploadsEnabled } from "@/lib/mux/client";
import { creatorVideoEditPath, creatorVideoPath, creatorVideosPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

export const metadata: Metadata = { title: "Video · Instik creator", robots: { index: false } };

type Params = { params: Promise<{ id: string }> };

const stageText = (slug: string | null) => (slug && stages.some((s) => s.slug === slug) ? stageLabel(slug as StageSlug) : null);
const topicText = (slug: string | null) => (slug && topics.some((t) => t.slug === slug) ? topicLabel(slug as TopicSlug) : null);
const minutes = (seconds: number | null) => (seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : null);

async function VideoScreen({ params }: Params) {
  const { id } = await params;
  const actor = await requireCreator(creatorVideoPath(id));
  const video = await getOwnVideo(actor, id);
  if (!video) notFound(); // another creator's video, a deleted one and a missing one all look the same
  const [history, playback] = await Promise.all([listStatusHistory(actor, id), getOwnPlayback(actor, id)]);
  const now = new Date();
  const display = displayStatus(video, now);
  const items = historyItems(history ?? []);
  const tokens = playback ? signPlaybackTokens({ playbackId: playback.playbackId, access: playback.access.toLowerCase(), durationSeconds: playback.durationSeconds ?? 0 }) : null;
  const meta = [stageText(video.proposedStage ?? video.stage), topicText(video.topic), minutes(video.durationSeconds)].filter(Boolean).join(" · ");
  // The note shown is the latest history entry's note, and none when that entry has none.
  const note = video.latestNote;
  const changes = canUploadNewVersion(video);

  return (
    <div className="flex max-w-[920px] flex-col gap-space-6">
      <Link href={creatorVideosPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        My videos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-space-4">
        <div className="flex flex-col gap-space-2">
          <h1 className="m-0 font-display text-title text-ink">{video.title.trim() || "Untitled video"}</h1>
          {meta && <p className="m-0 text-body-lg text-slate">{meta}</p>}
        </div>
        <StatusBadge display={display} />
      </div>

      <CreatorPreview playbackId={playback?.playbackId ?? null} tokens={tokens ?? undefined} title={video.title} />

      {note && (
        <section aria-labelledby="note-heading" className="flex flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-6">
          <h2 id="note-heading" className="m-0 font-display text-[22px] leading-7 font-extrabold text-ink">
            Note from Instik
          </h2>
          <p className="m-0 text-body-lg text-ink">{note}</p>
        </section>
      )}

      {video.pendingFailure && !changes && (
        <p role="alert" className="m-0 text-body text-coral-text">
          {video.pendingFailure}
        </p>
      )}

      {changes && (
        <section className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6">
          <VersionUpload
            videoId={video.id}
            details={{ title: video.title, description: video.description, proposedStage: video.proposedStage, topic: video.topic }}
            pendingLabel={display.pending?.label ?? null}
            failure={video.pendingFailure}
            uploadsEnabled={uploadsEnabled()}
          />
        </section>
      )}

      <div className="flex flex-wrap items-start gap-space-3">
        {canEditDetails(video) && (
          <Link
            href={creatorVideoEditPath(video.id)}
            className="inline-flex min-h-11 items-center rounded-md border border-ink bg-paper px-space-4 text-label font-semibold text-ink no-underline hover:text-ink"
          >
            Edit details
          </Link>
        )}
        {canDelete(video, now) && <DeleteDraft videoId={video.id} />}
      </div>

      <section aria-labelledby="history-heading" className="flex flex-col gap-space-4">
        <h2 id="history-heading" className="m-0 font-display text-[22px] leading-7 font-extrabold text-ink">
          History
        </h2>
        <HistoryList items={items} />
      </section>

      <section aria-labelledby="stats-heading" className="flex flex-col gap-space-2">
        <h2 id="stats-heading" className="m-0 font-display text-[22px] leading-7 font-extrabold text-ink">
          Stats
        </h2>
        <p className="m-0 text-body text-slate">Views, watch hours, completion and فاهم؟ answers appear here once the video is live.</p>
      </section>
    </div>
  );
}

export default function VideoPage({ params }: Params) {
  return (
    <Suspense fallback={<PageFallback />}>
      <VideoScreen params={params} />
    </Suspense>
  );
}
