import Link from "next/link";
import { notFound } from "next/navigation";
import { WeekStrip } from "@/components/done/WeekStrip";
import { TimeZoneSync } from "@/components/roadmap/TimeZoneSync";
import { getDoneView } from "@/lib/hours/queries";
import { formatHours, formatMinutes } from "@/lib/hours/totals";
import { getLanguageBySlug } from "@/lib/languages";
import { donePath, landingPath, libraryPath, roadmapPath } from "@/lib/routes";
import { requireProfile } from "@/lib/session";

const card = "flex flex-col gap-1 rounded-lg bg-cream/[0.08] p-space-4 sm:p-5";
const number = "font-display text-[28px] leading-9 font-extrabold sm:text-[32px] sm:leading-[38px]";

/** Reads the language param and the session, so it is rendered inside a Suspense boundary by the page. */
export async function DoneScreen({ params }: { params: Promise<{ language: string }> }) {
  const { language: slug } = await params;
  const language = getLanguageBySlug(slug);
  if (!language) notFound();

  const { learner } = await requireProfile(language.code, donePath(slug));
  const view = await getDoneView(learner.id, language.code);
  if (!view) notFound();

  return (
    // The session ends here, so this screen stands on its own over the page, as in the approved design.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink text-cream">
      <TimeZoneSync />
      <header className="mx-auto flex w-full max-w-[1240px] items-center px-space-6 py-5 sm:px-space-8">
        <Link
          href={landingPath()}
          className="flex min-h-11 items-center font-display text-[28px] leading-8 font-extrabold text-cream no-underline hover:text-cream"
        >
          instik
        </Link>
      </header>
      <main className="mx-auto flex max-w-[680px] flex-col items-center gap-space-8 px-space-6 pt-space-8 pb-20 text-center sm:px-space-8 sm:pt-12">
        <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Today's goal reached">
          <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10" className="stroke-cream/20" />
          <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-coral" />
          <path d="M42 61l12 12 24-26" fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="stroke-cream" />
        </svg>

        <div className="flex flex-col gap-space-3">
          <h1 className="m-0 font-display text-[36px] leading-[42px] font-extrabold sm:text-display">That&apos;s enough for today.</h1>
          <p className="m-0 text-[20px] leading-8 sm:text-[22px]">See you tomorrow.</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-space-3 sm:grid-cols-3">
          <div className={card}>
            <span className={number}>{formatMinutes(view.todaySeconds)}</span>
            <span className="text-label font-normal">watched today</span>
          </div>
          <div className={card}>
            <span className={number}>{view.videosToday}</span>
            <span className="text-label font-normal">{view.videosToday === 1 ? "video" : "videos"}</span>
          </div>
          <div className={card}>
            <span className={number}>{formatHours(view.totalSeconds)}</span>
            <span className="text-label font-normal">of {view.languageName}</span>
          </div>
        </div>

        <WeekStrip days={view.strip} />

        <div className="flex flex-wrap items-center justify-center gap-space-4">
          <Link
            href={roadmapPath(slug)}
            className="inline-flex h-[52px] items-center rounded-md bg-coral px-[26px] text-[16px] font-semibold text-ink no-underline hover:text-ink"
          >
            See your roadmap
          </Link>
          <Link href={libraryPath(slug)} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-cream underline hover:text-cream">
            I have a bit more time
          </Link>
        </div>
      </main>
    </div>
  );
}
