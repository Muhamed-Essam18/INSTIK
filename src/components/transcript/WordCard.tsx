"use client";

import { useEffect, useRef } from "react";
import { TargetText } from "@/components/TargetText";
import type { TranscriptViewEntry } from "@/lib/content/transcript";
import type { Language } from "@/lib/languages.schema";

type Props = {
  language: Language;
  entry: TranscriptViewEntry;
  /** `restoreFocus` is true when the learner pressed Escape, so focus should go back to the word. */
  onClose: (restoreFocus: boolean) => void;
};

export function WordCard({ language, entry, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // Presses or focus on another word button are left alone: that button switches the card itself.
    const outside = (target: EventTarget | null) =>
      target instanceof Node &&
      !cardRef.current?.contains(target) &&
      !(target instanceof Element && target.closest("[data-word-button]"));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current(true);
    };
    const onPointerDown = (event: Event) => {
      if (outside(event.target)) onCloseRef.current(false);
    };
    const onFocusIn = (event: Event) => {
      if (outside(event.target)) onCloseRef.current(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  // Stop the word's audio when the card goes away.
  useEffect(() => {
    return () => audioRef.current?.pause();
  }, []);

  const hear = () => {
    if (!entry.audio) return;
    audioRef.current ??= new Audio(entry.audio);
    void Promise.resolve(audioRef.current.play()).catch(() => {});
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Word: ${entry.english}`}
      onClick={(event) => event.stopPropagation()}
      className="mt-2 flex items-center gap-4 rounded-md bg-ink p-4 text-cream shadow-md"
    >
      <TargetText language={language} variant="transcript" sizeClass="text-[30px] leading-[44px]">
        {entry.word}
      </TargetText>
      <span className="flex grow flex-col text-[15px] leading-5">
        <span dir="ltr" className="italic">
          {entry.transliteration}
        </span>
        <span dir="ltr" lang="en" className="font-semibold">
          {entry.english}
        </span>
      </span>
      {entry.audio ? (
        <button
          type="button"
          aria-label="Hear it"
          onClick={hear}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-coral text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
