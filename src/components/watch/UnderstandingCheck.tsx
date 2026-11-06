"use client";

import { useEffect, useRef } from "react";
import { TargetText } from "@/components/TargetText";
import { usePlayback } from "@/components/player/PlaybackProvider";
import { useStoredValue } from "@/hooks/useStoredValue";
import type { Language } from "@/lib/languages.schema";
import { understoodKey, understoodSchema, type Understood } from "@/lib/player/preferences";

type Props = {
  languageSlug: string;
  language: Language;
  videoSlug: string;
};

const ANSWERS: { value: Understood; label: string }[] = [
  { value: "mostly", label: "Mostly" },
  { value: "some", label: "Some of it" },
  { value: "not-yet", label: "Not yet" },
];

const optionalUnderstood = understoodSchema.optional();

/** The optional "Did you follow this one?" check. No score; the answer stays on this device. */
export function UnderstandingCheck({ languageSlug, language, videoSlug }: Props) {
  const { registerCheck } = usePlayback();
  const [answer, setAnswer] = useStoredValue<Understood | undefined>(
    understoodKey(languageSlug, videoSlug),
    optionalUnderstood,
    undefined,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  // Lets the end of the video bring this card into view and focus the first answer.
  useEffect(() => {
    registerCheck(containerRef.current, firstRef.current);
    return () => registerCheck(null, null);
  }, [registerCheck]);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-5 rounded-lg bg-paper p-6 shadow-sm"
    >
      <div className="flex flex-[1_1_260px] flex-col gap-1">
        {language.understoodWord ? (
          <span className="self-start">
            <TargetText language={language} sizeClass="text-[22px] leading-[34px] font-medium">
              {language.understoodWord}
            </TargetText>
          </span>
        ) : null}
        <span className="text-body font-semibold">Did you follow this one?</span>
        <span className="text-caption text-slate">No score. It just helps us pick what&apos;s up next.</span>
      </div>
      <div role="group" aria-label="How much did you understand" className="flex flex-wrap gap-space-2">
        {ANSWERS.map(({ value, label }, i) => {
          const on = answer === value;
          return (
            <button
              key={value}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              aria-pressed={on}
              onClick={() => setAnswer(value)}
              className={`min-h-11 cursor-pointer rounded-md border px-[18px] text-label ${
                on ? "border-teal bg-teal text-ink" : "border-slate bg-paper text-ink"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
