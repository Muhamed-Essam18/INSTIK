import Link from "next/link";
import type { LibraryVideo } from "@/lib/content/search";
import { watchVideoPath } from "@/lib/routes";

type Props = {
  languageSlug: string;
  video: LibraryVideo;
  /** Alternates the thumbnail tone down a grid, as in the design. */
  tone?: number;
  /** A full-access video this learner cannot watch yet. Defaults to the video's own `locked` flag. */
  locked?: boolean;
};

export function VideoCard({ languageSlug, video, tone = 0, locked = video.locked ?? false }: Props) {
  return (
    <Link
      href={watchVideoPath(languageSlug, video.slug)}
      className="flex flex-col gap-space-3 rounded-lg bg-paper p-space-3 text-ink no-underline shadow-sm hover:text-ink"
    >
      <span
        className={`flex aspect-video flex-col items-start justify-between rounded-md p-2.5 ${
          tone % 2 ? "bg-cream" : "bg-coral-tint"
        }`}
      >
        <span aria-hidden="true" className="text-caption text-slate">
          [Thumbnail]
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-paper px-2.5 py-1 text-caption text-ink">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Full access
            </span>
          ) : null}
          <span className="rounded-pill bg-teal px-2.5 py-1 text-caption text-ink">{video.stageLabel}</span>
        </span>
      </span>
      <span className="flex flex-col gap-0.5 px-1 pb-1">
        <span className="text-[17px] leading-6 font-semibold">{video.title}</span>
        <span className="text-caption text-slate">
          {video.minutes} min · with {video.hostName}
        </span>
        {video.watched ? <span className="mt-1 text-caption font-semibold text-teal-text">Watched</span> : null}
      </span>
    </Link>
  );
}
