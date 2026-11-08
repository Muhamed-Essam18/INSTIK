"use client";

import type { MuxPlayerProps } from "@mux/mux-player-react";
import MuxPlayer from "@mux/mux-player-react/lazy";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useStoredValue";
import { AUTOPLAY_NEXT_KEY } from "@/lib/player/preferences";
import { resolveSource } from "@/lib/player/source";
import { startPosition } from "@/lib/player/start-position";
import { PlayerControls } from "./PlayerControls";
import { usePlayback, type PlayableMedia } from "./PlaybackProvider";

type Props = {
  /** From the video's content file; absent shows the placeholder, `sample-` ids play the sample clip, others go to Mux. */
  playbackId?: string;
  videoSlug: string;
  title: string;
  stageLabel: string;
  libraryHref: string;
};

// Mux's own controls are hidden; PlayerControls drives the element so every source looks and works the same.
const hideMuxControls = { "--controls": "none" } as MuxPlayerProps["style"];

const badge = "absolute rounded-pill px-3 py-1.5 text-caption font-semibold text-ink";

export function VideoPlayer({ playbackId, videoSlug, title, stageLabel, libraryHref }: Props) {
  const { setMedia, seekTo } = usePlayback();
  const source = resolveSource(playbackId);
  const hydrated = useHydrated();
  const [media, setLocalMedia] = useState<PlayableMedia | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const startParam = useSearchParams().get("t");
  const startedAt = useRef(false);

  // Stable identities: React calls a changed ref callback with null and then the element on every render.
  const register = useCallback(
    (element: PlayableMedia | null) => {
      setLocalMedia(element);
      setMedia(element);
    },
    [setMedia],
  );
  const registerMux = useCallback((element: unknown) => register(element as PlayableMedia | null), [register]);

  // Next keeps the previous page hidden but mounted; React runs layout-effect cleanups when a page is hidden or removed,
  // so a video never keeps playing (and sounding) after the learner has moved on.
  useLayoutEffect(() => {
    if (!media) return;
    return () => media.pause();
  }, [media]);

  // The previous video asked for this one to start (Autoplay next). Read once after mount; a refused play just leaves the Play button.
  useEffect(() => {
    if (!media) return;
    let requested: string | null = null;
    try {
      requested = window.sessionStorage.getItem(AUTOPLAY_NEXT_KEY);
      if (requested !== null) window.sessionStorage.removeItem(AUTOPLAY_NEXT_KEY);
    } catch {
      // no sessionStorage: nothing to do
    }
    if (requested === videoSlug) void Promise.resolve(media.play()).catch(() => {});
  }, [media, videoSlug]);

  // "Keep watching" opens the video near where the learner stopped (`?t=`). A position beyond the video is ignored.
  useEffect(() => {
    if (!media || startedAt.current) return;
    const apply = () => {
      if (startedAt.current) return;
      startedAt.current = true;
      const seconds = startPosition(startParam, media.duration);
      if (seconds > 0) seekTo(seconds);
    };
    if (Number.isFinite(media.duration) && media.duration > 0) {
      apply();
      return;
    }
    media.addEventListener("loadedmetadata", apply);
    return () => media.removeEventListener("loadedmetadata", apply);
  }, [media, startParam, seekTo]);

  return (
    <div
      ref={setContainer}
      className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-ink"
    >
      {source.kind === "sample" ? (
        <video
          ref={register}
          src={source.src}
          preload="metadata"
          playsInline
          aria-label={title}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}

      {source.kind === "mux" && hydrated ? (
        <MuxPlayer
          ref={registerMux}
          playbackId={source.playbackId}
          streamType="on-demand"
          playsInline
          nohotkeys
          metadata={{ video_title: title }}
          onError={() => setFailed(true)}
          style={hideMuxControls}
          className="absolute inset-0 size-full"
        />
      ) : null}

      {source.kind === "none" ? (
        <p className="m-0 px-6 text-center text-body-lg text-cream">This video is on its way.</p>
      ) : null}

      {source.kind === "sample" ? (
        <span className={`${badge} top-4 left-5 bg-sun`}>Sample</span>
      ) : null}
      <span className={`${badge} top-4 right-5 bg-teal`}>{stageLabel}</span>

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-cream">
          <p className="m-0 text-body-lg">This video didn&apos;t load. Try again in a moment.</p>
          <Link href={libraryHref} className="inline-flex min-h-11 items-center text-label text-cream underline hover:text-cream">
            Back to the Library
          </Link>
        </div>
      ) : media && !failed ? (
        <PlayerControls media={media} container={container} />
      ) : null}
    </div>
  );
}
