import Link from "next/link";
import { getHost, getVideo } from "@/lib/content";
import { watchVideoPath } from "@/lib/routes";

// Static until real watch history exists (a later spec replaces this constant).
const PICK_UP = { videoSlug: "at-the-cafe", positionSeconds: 134 };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function PickUpBanner({ languageSlug }: { languageSlug: string }) {
  const video = getVideo(languageSlug, PICK_UP.videoSlug);
  const host = video && getHost(languageSlug, video.host);
  if (!video || !host) return null;

  return (
    <Link
      href={watchVideoPath(languageSlug, video.slug)}
      className="flex flex-wrap items-center gap-space-6 rounded-lg bg-ink p-space-6 text-cream no-underline hover:text-cream"
    >
      <span className="flex aspect-video w-[200px] items-center justify-center rounded-md bg-coral-tint">
        <span className="flex size-[52px] items-center justify-center rounded-pill bg-coral">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5z" fill="#1b2340" />
          </svg>
        </span>
      </span>
      <span className="flex flex-1 basis-[280px] flex-col gap-space-1">
        <span className="text-label">Pick up where you left off</span>
        <span className="font-display text-[28px] leading-[34px] font-extrabold">{video.title}</span>
        <span className="text-label font-normal">
          {clock(PICK_UP.positionSeconds)} of {clock(video.durationSeconds)} · with {host.name}
        </span>
      </span>
      <span className="inline-flex h-12 items-center rounded-md bg-coral px-[22px] text-[15px] font-semibold text-ink">
        Keep watching
      </span>
    </Link>
  );
}
