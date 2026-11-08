import { notFound } from "next/navigation";
import { AddTimeDialog } from "@/components/roadmap/AddTimeDialog";
import { AddedTimeList } from "@/components/roadmap/AddedTimeList";
import { HoursRing } from "@/components/roadmap/HoursRing";
import { RhythmGrid } from "@/components/roadmap/RhythmGrid";
import { SessionSettings } from "@/components/roadmap/SessionSettings";
import { StageList } from "@/components/roadmap/StageList";
import { TimeZoneSync } from "@/components/roadmap/TimeZoneSync";
import { HONEST_NOTE, heroHeading, heroSupport } from "@/lib/hours/copy";
import { getRoadmapView } from "@/lib/hours/queries";
import { formatHours } from "@/lib/hours/totals";
import { getLanguageBySlug } from "@/lib/languages";
import { roadmapPath } from "@/lib/routes";
import { requireProfile } from "@/lib/session";

/** Reads the language param and the session, so it is rendered inside a Suspense boundary by the page. */
export async function RoadmapScreen({ params }: { params: Promise<{ language: string }> }) {
  const { language: slug } = await params;
  const language = getLanguageBySlug(slug);
  if (!language) notFound();

  const { learner } = await requireProfile(language.code, roadmapPath(slug));
  const view = await getRoadmapView(learner.id, language.code);
  if (!view) notFound();

  const addedSeconds = view.addedMinutes * 60;

  return (
    <div className="flex flex-col gap-space-8">
      <TimeZoneSync />

      <section
        aria-labelledby="hours-heading"
        className="flex flex-wrap items-center gap-space-8 rounded-lg bg-paper p-space-8 sm:p-space-12"
      >
        <HoursRing totalSeconds={view.totalSeconds} stage={view.stage} progress={view.progress} />
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-space-3">
          <h1 id="hours-heading" className="m-0 font-display text-title text-ink">
            {heroHeading(view.totalSeconds, view.languageName)}
          </h1>
          <p className="m-0 text-body-lg text-ink">{heroSupport(view.stage, view.languageName)}</p>
          <p className="m-0 text-label font-normal text-slate">{HONEST_NOTE}</p>
          {view.addedMinutes > 0 ? (
            <p className="m-0 text-label font-normal text-slate">
              {formatHours(view.watchedSeconds)} watched · {formatHours(addedSeconds)} added by you
            </p>
          ) : null}
        </div>
        <AddTimeDialog languageCode={language.code} today={view.today} />
      </section>

      <StageList
        states={view.states}
        progress={view.progress}
        moreHours={view.moreHours}
        nextStage={view.nextStage}
        hasEstimates={view.hasEstimates}
      />

      <div className="flex flex-wrap gap-space-6">
        <RhythmGrid rhythm={view.rhythm} />
        <SessionSettings
          languageCode={language.code}
          minutesPerDay={view.minutesPerDay}
          remindersOn={view.remindersOn}
          hourSound={view.hourSound}
        />
      </div>

      <AddedTimeList languageCode={language.code} entries={view.entries} />
    </div>
  );
}
