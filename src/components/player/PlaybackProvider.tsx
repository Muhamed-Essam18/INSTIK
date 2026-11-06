"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AUTOPLAY_KEY, AUTOPLAY_NEXT_KEY, autoplaySchema, readStored } from "@/lib/player/preferences";

/** What the controls and transcript need from a media element; HTMLVideoElement and the Mux player element both satisfy it. */
export interface PlayableMedia {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  playbackRate: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

type PlaybackContextValue = {
  media: PlayableMedia | null;
  /** Ref callback for the player: registers the element, or clears it with null. */
  setMedia: (element: PlayableMedia | null) => void;
  /** Moves playback to `seconds`; does nothing without a media element. */
  seekTo: (seconds: number) => void;
  /** The understanding check registers itself here so the end of the video can bring it into view; null clears it. */
  registerCheck: (container: HTMLElement | null, firstAnswer: HTMLElement | null) => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** The first Up next video; with Autoplay next on, the end of this video opens it. Absent means there is none. */
  nextHref?: string;
  nextSlug?: string;
};

/** Lets the player, transcript and other client islands share the media element while the page stays a Server Component. */
export function PlaybackProvider({ children, nextHref, nextSlug }: Props) {
  const router = useRouter();
  const [media, setMediaState] = useState<PlayableMedia | null>(null);
  const mediaRef = useRef<PlayableMedia | null>(null);
  const checkRef = useRef<{ container: HTMLElement; firstAnswer: HTMLElement } | null>(null);

  const setMedia = useCallback((element: PlayableMedia | null) => {
    mediaRef.current = element;
    setMediaState(element);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (mediaRef.current) mediaRef.current.currentTime = seconds;
  }, []);

  const registerCheck = useCallback((container: HTMLElement | null, firstAnswer: HTMLElement | null) => {
    checkRef.current = container && firstAnswer ? { container, firstAnswer } : null;
  }, []);

  // At the end of the video, bring the understanding check into view and focus its first answer (selecting nothing).
  useEffect(() => {
    if (!media) return;
    const onEnded = async () => {
      // With Autoplay next on (and something to play), open the next video instead of drawing attention to the check.
      if (nextHref && nextSlug && readStored(AUTOPLAY_KEY, autoplaySchema) === true) {
        try {
          window.sessionStorage.setItem(AUTOPLAY_NEXT_KEY, nextSlug);
        } catch {
          // without sessionStorage the next video simply waits for its play button
        }
        router.push(nextHref);
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      const check = checkRef.current;
      if (!check) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      check.container.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      check.firstAnswer.focus({ preventScroll: true });
    };
    media.addEventListener("ended", onEnded);
    return () => media.removeEventListener("ended", onEnded);
  }, [media, nextHref, nextSlug, router]);

  const value = useMemo(() => ({ media, setMedia, seekTo, registerCheck }), [media, setMedia, seekTo, registerCheck]);
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackContextValue {
  const context = useContext(PlaybackContext);
  if (!context) throw new Error("usePlayback must be used inside a PlaybackProvider");
  return context;
}
