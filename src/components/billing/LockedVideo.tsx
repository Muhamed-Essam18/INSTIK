import Link from "next/link";
import { HostCard } from "@/components/watch/HostCard";
import { coralButton } from "@/components/marketing/buttons";
import type { PublicHost } from "@/lib/content/mappers";
import { libraryPath, pricingPath } from "@/lib/routes";

type Props = {
  languageSlug: string;
  title: string;
  /** "Hear it · 8:40 · Egyptian Arabic", the same line the player page shows. */
  meta: string;
  host: PublicHost;
  firstHost?: boolean;
};

/**
 * Shown on the player page in place of the video and transcript when the learner has no access to this video.
 * An ordinary part of the page: no dialog, no overlay, no countdown. It never receives the playback id or the transcript.
 */
export function LockedVideo({ languageSlug, title, meta, host, firstHost = false }: Props) {
  return (
    <div className="flex flex-col gap-space-6">
      <section
        aria-labelledby="locked-heading"
        className="flex aspect-video min-h-[260px] flex-col items-center justify-center gap-space-4 rounded-lg bg-paper px-space-6 py-space-8 text-center"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1b2340" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <h2 id="locked-heading" className="m-0 font-display text-heading text-ink">
          This one is part of Full access.
        </h2>
        <p className="m-0 max-w-[420px] text-body text-slate">
          Free videos are still here for you, and your hours stay exactly as they are.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-space-4">
          <Link href={pricingPath()} className={`${coralButton} min-h-12 px-[22px] text-[15px]`}>
            See Full access
          </Link>
          <Link href={libraryPath(languageSlug)} className="inline-flex min-h-11 items-center text-label underline">
            Back to the library
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-space-6">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-space-2">
          <h1 className="m-0 font-display text-title text-ink">{title}</h1>
          <p className="m-0 text-caption text-slate">{meta}</p>
        </div>
        <HostCard languageSlug={languageSlug} host={host} first={firstHost} />
      </div>
    </div>
  );
}
