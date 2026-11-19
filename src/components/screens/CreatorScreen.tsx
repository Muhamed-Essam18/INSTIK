import Link from "next/link";
import { EarningsCard } from "@/components/creator/EarningsCard";
import { RequestsList } from "@/components/creator/RequestsList";
import { StatTile } from "@/components/creator/StatTile";
import { TopVideos } from "@/components/creator/TopVideos";
import { WeeklyViews } from "@/components/creator/WeeklyViews";
import { formatHours, formatMonth, formatShare } from "@/lib/earnings/format";
import { earningsService } from "@/lib/earnings/instance";
import { getLanguageByCode } from "@/lib/languages";
import { creatorPath, creatorUploadPath, creatorVideosPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

/**
 * The creator Dashboard (docs/design/CreatorDashboard.dc.html): video counts, this month's counted views, watch hours, unique learners and
 * average completion, views per week, earnings, top videos with their فاهم؟ answers and requests from Instik. Everything is the signed-in
 * creator's own: the service takes only the actor. Reads the session and the database, so the page renders it behind Suspense.
 * A learner or an owner who is not a creator gets a not-found page.
 */
export async function CreatorScreen() {
  const actor = await requireCreator(creatorPath());
  const data = await earningsService().getDashboard(actor);
  const first = (data.creatorName || actor.name || "").trim().split(/\s+/)[0];
  const language = data.languageCode ? getLanguageByCode(data.languageCode) : undefined;
  const languageName = language ? `${language.variety ?? ""} ${language.name}`.trim() : "";
  const { counts } = data;

  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-wrap items-center gap-space-3">
        <div className="grow">
          <h1 className="m-0 font-display text-title text-ink">{first ? `Welcome back, ${first}` : "Welcome back"}</h1>
          <p className="m-0 mt-space-1 text-body-lg text-slate">{[formatMonth(data.month), languageName].filter(Boolean).join(" · ")}</p>
        </div>
        <Link href={creatorUploadPath()} className="inline-flex min-h-11 items-center justify-center rounded-md bg-coral px-space-6 text-label font-semibold text-ink">
          Upload a video
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-space-4">
        <StatTile label="Videos uploaded" value={String(counts.uploaded)} />
        <StatTile label="In review" value={String(counts.inReview)} note="We'll reply within a few days" />
        <StatTile label="Approved" value={String(counts.approved)} />
        <StatTile
          label="Changes requested"
          value={String(counts.changes)}
          note={
            counts.changes > 0 ? (
              <Link href={creatorVideosPath("changes")} className="font-semibold underline">
                See the note
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-space-4">
        <StatTile label="Counted views" value={data.views.toLocaleString("en-GB")} note="This month" />
        <StatTile label="Watch hours" value={formatHours(data.watchSeconds)} note="This month" />
        <StatTile label="Unique learners" value={data.learners.toLocaleString("en-GB")} note="This month" />
        <StatTile
          label="Average completion"
          value={data.averageCompletion === null ? "—" : formatShare(data.averageCompletion)}
          note={data.averageCompletion === null ? "Nothing watched yet this month" : "Across videos watched this month"}
        />
      </div>

      <div className="flex flex-wrap items-stretch gap-space-6">
        <section aria-labelledby="views-heading" className="flex min-w-0 grow-[2] basis-[420px] flex-col gap-space-3">
          <h2 id="views-heading" className="m-0 font-display text-heading text-ink">
            Views
          </h2>
          <WeeklyViews weeks={data.weeks} />
        </section>
        <div className="min-w-0 grow basis-[300px]">
          <EarningsCard earnings={data.earnings} month={data.month} />
        </div>
      </div>

      <TopVideos videos={data.top} />
      <RequestsList requests={data.requests} />
    </div>
  );
}
