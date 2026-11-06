"use client";

import { useSyncExternalStore } from "react";
import { useHydrated } from "@/hooks/useStoredValue";
import { formatClock } from "@/lib/player/format";
import { seekMedia, setMediaRate, skipMedia } from "@/lib/player/media";
import type { PlayableMedia } from "./PlaybackProvider";

const RATES = [1, 0.9, 0.75] as const;

const iconButton =
  "flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent text-cream";

/** Re-renders when the media emits any of `events`; `read` must return a primitive. */
function useMediaValue<T extends string | number | boolean>(
  media: PlayableMedia,
  events: string[],
  read: (media: PlayableMedia) => T,
): T {
  return useSyncExternalStore(
    (notify) => {
      events.forEach((type) => media.addEventListener(type, notify));
      return () => events.forEach((type) => media.removeEventListener(type, notify));
    },
    () => read(media),
    () => read(media),
  );
}

function subscribeFullscreen(notify: () => void) {
  document.addEventListener("fullscreenchange", notify);
  return () => document.removeEventListener("fullscreenchange", notify);
}

type Props = {
  media: PlayableMedia;
  /** The element that goes full screen, so these controls stay on top of the video. */
  container: HTMLElement | null;
};

/** The control bar and big Play button from the design, driving any media element. */
export function PlayerControls({ media, container }: Props) {
  const paused = useMediaValue(media, ["play", "pause", "ended"], (m) => m.paused);
  const seconds = useMediaValue(media, ["timeupdate", "seeked", "loadedmetadata"], (m) => Math.floor(m.currentTime || 0));
  const duration = useMediaValue(media, ["durationchange", "loadedmetadata"], (m) =>
    Number.isFinite(m.duration) ? Math.floor(m.duration) : 0,
  );
  const rate = useMediaValue(media, ["ratechange"], (m) => m.playbackRate);

  const hydrated = useHydrated();
  const canFullscreen = hydrated && document.fullscreenEnabled;
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null && document.fullscreenElement === container,
    () => false,
  );

  const started = seconds > 0 || !paused;
  const togglePlay = () => {
    if (media.paused) void Promise.resolve(media.play()).catch(() => {});
    else media.pause();
  };
  const nextRate = RATES[(Math.max(0, RATES.indexOf(rate as (typeof RATES)[number])) + 1) % RATES.length];
  const toggleFullscreen = () => {
    // The browser may refuse (not allowed, or no support); the page simply stays as it is.
    const request = document.fullscreenElement ? document.exitFullscreen() : container?.requestFullscreen?.();
    void Promise.resolve(request).catch(() => {});
  };
  const playLabel = paused ? "Play" : "Pause";

  return (
    <>
      {!started ? (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 flex size-[88px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill border-0 bg-coral"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5z" fill="#1b2340" />
          </svg>
        </button>
      ) : null}

      <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-3 px-5 py-4">
        <input
          type="range"
          aria-label="Seek"
          aria-valuetext={`${formatClock(seconds)} of ${formatClock(duration)}`}
          min={0}
          max={duration}
          step={1}
          value={Math.min(seconds, duration)}
          disabled={duration === 0}
          onChange={(event) => {
            seekMedia(media, Number(event.target.value));
          }}
          className="h-11 w-full cursor-pointer accent-coral"
        />
        <div className="flex items-center gap-4 text-label font-medium text-cream">
          <button type="button" aria-label={playLabel} onClick={togglePlay} className={iconButton}>
            {paused ? (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M8 5v14M16 5v14" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Back 5 seconds"
            onClick={() => {
              skipMedia(media, -5);
            }}
            className={iconButton}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
          <span>
            {formatClock(seconds)} / {formatClock(duration)}
          </span>
          <span className="grow" />
          <button
            type="button"
            aria-label={`Playback speed ${rate}×. Change speed.`}
            onClick={() => {
              setMediaRate(media, nextRate);
            }}
            className="min-h-11 cursor-pointer rounded-pill border border-cream/40 bg-transparent px-3 text-caption font-semibold text-cream"
          >
            {rate}×
          </button>
          {canFullscreen ? (
            <button
              type="button"
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
              className={iconButton}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
