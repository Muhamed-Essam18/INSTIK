import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorPreview } from "@/components/creator/CreatorPreview";
import { ReviewHistory } from "@/components/owner/ReviewHistory";
import { ReviewWorkspace } from "@/components/owner/ReviewWorkspace";
import { signPreviewTokens } from "@/lib/billing/playback";
import { defaultLanguage, getLanguageByCode } from "@/lib/languages";
import { queueBadge } from "@/lib/review/rules";
import { shortDate, stageName } from "@/lib/review/format";
import { reviewService } from "@/lib/review/instance";
import { ownerPath, ownerReviewVideoPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/**
 * The review screen for one video: player, checklist, stage and access, the transcript and the decision. Reads the session and the
 * database, so the page renders it behind Suspense. A missing video, or one that is not in review or waiting on its creator, is not found.
 * A video in Changes requested is shown read-only. Mux ids never reach the browser: only the playback id and short-lived tokens do.
 */
export async function OwnerReviewScreen({ id }: { id: string }) {
  const actor = await requireOwner(ownerReviewVideoPath(id));
  const view = await reviewService().getReview(actor, id);
  if (!view) notFound();
  const { video } = view;
  const language = getLanguageByCode(video.languageCode) ?? defaultLanguage;
  // Videos in review are always signed: review playback needs a token whatever access the owner is about to choose.
  const tokens = signPreviewTokens(video);
  const stage = video.stage ?? video.proposedStage;
  const badge = view.readOnly ? "Changes requested" : queueBadge(view.segments.length);
  const requested = view.history.find((h) => h.toStatus === "CHANGES_REQUESTED");

  return (
    <div className="flex flex-col gap-space-8">
      <Link href={ownerPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        Review queue
      </Link>
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">{video.title.trim() || "Untitled video"}</h1>
        <p className="m-0 flex flex-wrap items-center gap-x-space-2 text-body-lg text-slate">
          <span>
            {video.creatorName} · {stageName(stage)}
            {view.submittedAt ? ` · submitted ${shortDate(view.submittedAt)}` : ""}
          </span>
          <span className="inline-flex items-center rounded-pill bg-sun px-space-3 py-1 text-label font-semibold text-ink">{badge}</span>
        </p>
      </div>
      <ReviewWorkspace
        videoId={video.id}
        player={<CreatorPreview playbackId={video.playbackId} tokens={tokens ?? undefined} title={video.title} />}
        checks={video.checks}
        stage={stage ?? "hear-it"}
        access={video.access}
        segments={view.segments}
        entries={view.entries}
        lang={language.code}
        dir={language.direction}
        scriptLabel={`${language.variety} ${language.name}, with tashkeel`}
        creatorName={video.creatorName}
        readOnly={view.readOnly}
        readOnlyNote={
          <div className="flex flex-col gap-space-2 rounded-lg border border-hairline bg-paper p-space-6">
            <p className="m-0 text-body-lg text-ink">
              Waiting on {video.creatorName}. {requested ? `Changes were requested on ${shortDate(requested.createdAt)}.` : "Changes were requested."} This video comes back to the
              queue when they send a new version.
            </p>
            {requested?.note && <p className="m-0 text-body text-slate">{requested.note}</p>}
          </div>
        }
      />
      <section aria-labelledby="history" className="flex flex-col gap-space-4">
        <h2 id="history" className="m-0 font-display text-heading text-ink">
          History
        </h2>
        <ReviewHistory items={view.history} />
      </section>
    </div>
  );
}
