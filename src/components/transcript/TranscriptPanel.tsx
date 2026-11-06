"use client";

import { useEffect, useRef, useState } from "react";
import { TargetText } from "@/components/TargetText";
import { usePlayback } from "@/components/player/PlaybackProvider";
import type { TranscriptView } from "@/lib/content/transcript";
import type { Language } from "@/lib/languages.schema";
import { findCueIndex } from "@/lib/player/cue-index";
import { formatClock } from "@/lib/player/format";
import { DEFAULT_LAYERS, type Layers } from "@/lib/player/preferences";
import { stripTashkeel } from "@/lib/text/normalize";
import { useAccountLayers } from "@/hooks/useAccountLayers";
import { SaveNote } from "@/components/watch/SaveNote";
import { LayerToggles } from "./LayerToggles";
import { WordCard } from "./WordCard";

type Props = {
  language: Language;
  /** Undefined when the video has no transcript yet. */
  view: TranscriptView | undefined;
  /** The learner's layers from their account; the defaults when they have not changed anything. */
  initialLayers?: Layers;
};

const MEDIA_EVENTS = ["timeupdate", "seeking", "seeked"];

type OpenWord = { line: number; segment: number; entryId: string };

const wordKey = (line: number, segment: number) => `${line}:${segment}`;

export function TranscriptPanel({ language, view, initialLayers = DEFAULT_LAYERS }: Props) {
  const { media, seekTo } = usePlayback();
  const lines = view?.lines;
  const [layers, setLayers, saveFailed] = useAccountLayers({
    initial: initialLayers,
    languageCode: language.code,
    allowed: language.transcriptLayers,
  });
  // Tashkeel alone shows nothing, so it does not count as a displayed layer.
  const showing = {
    script: layers.script && language.transcriptLayers.includes("script"),
    transliteration: layers.transliteration && language.transcriptLayers.includes("transliteration"),
    english: layers.english && language.transcriptLayers.includes("english"),
  };
  const anyLayer = showing.script || showing.transliteration || showing.english;
  const [current, setCurrent] = useState(-1);
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const currentRef = useRef(-1);
  const wordRefs = useRef(new Map<string, HTMLButtonElement>());
  const [openWord, setOpenWord] = useState<OpenWord | null>(null);

  // The current line follows the media element; state only changes when the line does, so the list rarely re-renders.
  useEffect(() => {
    if (!media || !lines || lines.length === 0) return;
    const update = () => {
      const index = findCueIndex(lines, media.currentTime);
      if (index === currentRef.current) return; // same line: no state update, no render
      currentRef.current = index;
      setCurrent(index);
    };
    MEDIA_EVENTS.forEach((type) => media.addEventListener(type, update));
    return () => MEDIA_EVENTS.forEach((type) => media.removeEventListener(type, update));
  }, [media, lines]);

  // Keep the current line in view by scrolling the list itself, never the page.
  useEffect(() => {
    if (current < 0) return;
    const list = listRef.current;
    const row = rowRefs.current[current];
    if (!list || !row) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    list.scrollTo?.({ top: Math.max(0, row.offsetTop - 12), behavior: reduceMotion ? "auto" : "smooth" });
  }, [current]);

  return (
    <aside
      aria-label="Transcript"
      className="flex max-w-[560px] min-w-0 flex-[1_1_420px] flex-col rounded-lg bg-paper shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-hairline px-6 pt-5 pb-4">
        <h2 className="m-0 font-display text-heading text-ink">Transcript</h2>
        {lines ? <LayerToggles language={language} layers={layers} onChange={setLayers} /> : null}
        <SaveNote show={saveFailed} />
      </div>

      {lines ? (
        <>
          <ol
            ref={listRef}
            className="relative m-0 flex max-h-[70vh] list-none flex-col gap-1 overflow-y-auto p-3"
          >
            {lines.map((line, i) => {
              const isCurrent = i === current;
              return (
                <li
                  key={line.start}
                  ref={(element) => {
                    rowRefs.current[i] = element;
                  }}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`rounded-md ${isCurrent ? "bg-coral-tint" : "bg-paper"}`}
                >
                  {/* The row is clickable for pointer users; the time button is the keyboard and screen reader route. */}
                  <div
                    role="presentation"
                    onClick={() => seekTo(line.start)}
                    className="flex cursor-pointer flex-col gap-0.5 px-4 py-3"
                  >
                    <button
                      type="button"
                      aria-label={`Jump to ${formatClock(line.start)}`}
                      className="-my-2.5 inline-flex min-h-11 min-w-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-[12px] leading-[18px] font-medium text-slate"
                    >
                      {formatClock(line.start)}
                    </button>
                    {showing.script ? (
                      <TargetText language={language} variant="transcript" className="block text-right">
                        {line.segments.map((segment, s) => {
                          const text = layers.tashkeel ? segment.text : stripTashkeel(segment.text);
                          const { entryId } = segment;
                          if (!entryId) return text;
                          const key = wordKey(i, s);
                          const open = openWord?.line === i && openWord.segment === s;
                          return (
                            <button
                              key={key}
                              ref={(element) => {
                                if (element) wordRefs.current.set(key, element);
                                else wordRefs.current.delete(key);
                              }}
                              type="button"
                              data-word-button=""
                              aria-haspopup="dialog"
                              aria-expanded={open}
                              onClick={(event) => {
                                event.stopPropagation(); // a word opens its card; it does not jump the video
                                setOpenWord(open ? null : { line: i, segment: s, entryId });
                              }}
                              className={`cursor-pointer rounded-sm border-0 p-0 font-[inherit] text-[length:inherit] leading-[inherit] text-ink underline decoration-slate decoration-dotted underline-offset-[6px] ${
                                open ? "bg-sun" : "bg-transparent"
                              }`}
                            >
                              {text}
                            </button>
                          );
                        })}
                      </TargetText>
                    ) : null}
                    {showing.transliteration && line.transliteration ? (
                      <p dir="ltr" className="m-0 text-translit italic text-ink">
                        {line.transliteration}
                      </p>
                    ) : null}
                    {showing.english && line.english ? (
                      <p dir="ltr" lang="en" className="m-0 text-translit text-slate">
                        {line.english}
                      </p>
                    ) : null}
                    {view && openWord?.line === i ? (
                      <WordCard
                        language={language}
                        entry={view.entries[openWord.entryId]}
                        onClose={(restoreFocus) => {
                          const key = wordKey(openWord.line, openWord.segment);
                          setOpenWord(null);
                          if (restoreFocus) wordRefs.current.get(key)?.focus();
                        }}
                      />
                    ) : null}
                    {!anyLayer ? <p className="m-0 text-caption text-slate">Switch a layer on to read along.</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="m-0 px-6 pb-5 text-caption text-slate">Tap any word for its meaning.</p>
        </>
      ) : (
        <p className="m-0 p-6 text-body text-slate">The transcript is on its way.</p>
      )}
    </aside>
  );
}
