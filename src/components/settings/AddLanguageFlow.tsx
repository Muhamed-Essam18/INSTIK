"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LevelStep } from "@/components/onboarding/LevelStep";
import { TimeStep } from "@/components/onboarding/TimeStep";
import { languageName } from "@/components/onboarding/LanguageStep";
import { addLanguage } from "@/lib/learner/actions";
import {
  DEFAULT_LEVEL,
  DEFAULT_MINUTES,
  stageForLevel,
  type Level,
  type Minutes,
  type OfferState,
} from "@/lib/learner/profile-rules";
import type { Language } from "@/lib/languages.schema";
import { libraryPath } from "@/lib/routes";
import { AddLanguageList } from "./AddLanguageList";

type Props = {
  offers: ReadonlyArray<{ language: Language; state: OfferState }>;
  /** A language code to start with (for example from a video the learner has no profile for). */
  preselected?: string;
  /** A checked address to go to afterwards; otherwise the Library of the new language. */
  returnTo?: string;
};

/** "Add a language": choose it, say how much you know and how long you have, then it is added to the account. */
export function AddLanguageFlow({ offers, preselected, returnTo }: Props) {
  const router = useRouter();
  const startCode = offers.some((o) => o.language.code === preselected && o.state === "available") ? preselected : undefined;
  const [code, setCode] = useState<string | undefined>(startCode);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [minutes, setMinutes] = useState<Minutes>(DEFAULT_MINUTES);
  const [status, setStatus] = useState<"idle" | "saving" | "failed" | "exists">("idle");

  const language = offers.find((o) => o.language.code === code)?.language;

  async function add() {
    if (!language) return;
    setStatus("saving");
    try {
      const result = await addLanguage({
        languageCode: language.code,
        stage: stageForLevel(level),
        minutesPerDay: minutes,
      });
      if (result.ok) {
        router.push(returnTo ?? libraryPath(language.slug));
        return;
      }
      setStatus(result.code === "exists" ? "exists" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  if (!language) {
    return <AddLanguageList offers={offers} value={code} onChoose={setCode} />;
  }

  return (
    <div className="flex flex-col gap-space-8">
      <section className="flex flex-col gap-space-6">
        <h2 className="m-0 font-display text-heading text-ink">How much {languageName(language)} do you know?</h2>
        <LevelStep value={level} onChoose={setLevel} />
      </section>
      <section className="flex flex-col gap-space-6">
        <h2 className="m-0 font-display text-heading text-ink">How long do you usually have?</h2>
        <TimeStep value={minutes} onChoose={setMinutes} />
      </section>
      {status === "failed" && (
        <p role="alert" className="m-0 text-label text-coral-text">
          We couldn&apos;t add that just now. Please try again.
        </p>
      )}
      {status === "exists" && (
        <p role="alert" className="m-0 text-label text-coral-text">
          You&apos;ve already added {languageName(language)}. You can change it in your settings.
        </p>
      )}
      <div className="flex items-center gap-space-3">
        <button type="button" onClick={() => setCode(undefined)} className="h-[52px] rounded-md px-5 text-body font-semibold text-ink">
          Back
        </button>
        <div className="grow" />
        <button
          type="button"
          onClick={add}
          disabled={status === "saving"}
          className="h-[52px] rounded-md bg-coral px-7 text-body font-semibold text-ink disabled:opacity-60"
        >
          {status === "saving" ? "Adding…" : `Add ${languageName(language)}`}
        </button>
      </div>
    </div>
  );
}
