import Link from "next/link";
import type { LibraryVideo } from "@/lib/content/search";
import { watchVideoPath } from "@/lib/routes";

type Props = {
  languageSlug: string;
  video: LibraryVideo;
  /** Alternates the thumbnail tone down a grid, as in the design. */
  tone?: number;
};

export function VideoCard({ languageSlug, video, tone = 0 }: Props) {
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
        <span className="rounded-pill bg-teal px-2.5 py-1 text-caption text-ink">{video.stageLabel}</span>
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
