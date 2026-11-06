"use client";

import { useEffect, useMemo, useRef } from "react";
import type { z } from "zod";
import { useStoredValue } from "@/hooks/useStoredValue";
import type { Language } from "@/lib/languages.schema";
import {
  EMPTY_DRAFT,
  chooseLanguage,
  chooseLevel,
  chooseMinutes,
  clampStep,
  confirmLevel,
  confirmMinutes,
  draftSchema,
  normaliseDraft,
  type Draft,
  type Step,
} from "@/lib/onboarding/draft";
import { ONBOARDING_KEY } from "@/lib/onboarding/draft-storage";
import { accountStep, languageStep, languageStepTitle, levelStep, nav, timeStep } from "@/lib/onboarding/copy";
import { AccountStep } from "./AccountStep";
import { LanguageStep, languageName } from "./LanguageStep";
import { LevelStep } from "./LevelStep";
import { StepProgress } from "./StepProgress";
import { TimeStep } from "./TimeStep";

type Props = {
  languages: readonly Language[];
  signedIn: boolean;
  /** Where the learner was going; kept through sign-up and checked again on the server. */
  returnTo?: string;
  /** The language code of the page the learner was going to, when there is one: skips the language question. */
  preferredLanguage?: string;
};

const draftValueSchema = draftSchema as unknown as z.ZodType<Draft>;

/** The four onboarding steps. Choices are kept on this device until the account exists. */
export function OnboardingFlow({ languages, signedIn, returnTo, preferredLanguage }: Props) {
  const codes = useMemo(() => languages.map((l) => l.code), [languages]);
  const [stored, setStored, ready] = useStoredValue<Draft>(ONBOARDING_KEY, draftValueSchema, EMPTY_DRAFT);

  // Until the device has been read, show the first step so server and first client render match.
  const saved = ready ? normaliseDraft(stored, codes) : EMPTY_DRAFT;
  const hint = preferredLanguage && codes.includes(preferredLanguage) ? preferredLanguage : undefined;
  const draft: Draft = saved.language || !hint ? saved : { ...saved, language: hint, step: Math.max(saved.step, 2) as Step };
  const step = clampStep(draft, draft.step);

  const language = languages.find((l) => l.code === draft.language);
  const save = (next: Draft) => setStored(next);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  const heading =
    step === 1
      ? { title: languageStep.title, sub: languageStep.sub }
      : step === 2
        ? { title: languageStepTitle(language ? languageName(language) : "this language"), sub: levelStep.sub }
        : step === 3
          ? { title: timeStep.title, sub: timeStep.sub }
          : { title: accountStep.title, sub: accountStep.sub };

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-space-8">
      <StepProgress step={step} />

      <section className="flex flex-col gap-space-6">
        <div className="flex flex-col gap-space-2">
          <h1 ref={headingRef} tabIndex={-1} className="m-0 font-display text-title text-ink focus:outline-none">
            {heading.title}
          </h1>
          <p className="m-0 text-body-lg text-slate">{heading.sub}</p>
        </div>

        {step === 1 && (
          <LanguageStep
            languages={languages}
            value={draft.language}
            onChoose={(code) => save({ ...chooseLanguage(draft, code), step: 2 })}
          />
        )}
        {step === 2 && <LevelStep value={draft.level} onChoose={(level) => save(chooseLevel(draft, level))} />}
        {step === 3 && <TimeStep value={draft.minutes} onChoose={(m) => save(chooseMinutes(draft, m))} />}
        {step === 4 && <AccountStep signedIn={signedIn} returnTo={returnTo} />}
      </section>

      <div className="flex items-center gap-space-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => save({ ...draft, step: (step - 1) as Step })}
            className="h-[52px] rounded-md px-5 text-body font-semibold text-ink"
          >
            {nav.back}
          </button>
        )}
        <div className="grow" />
        {(step === 2 || step === 3) && (
          <button
            type="button"
            onClick={() =>
              save(step === 2 ? { ...confirmLevel(draft), step: 3 } : { ...confirmMinutes(draft), step: 4 })
            }
            className="h-[52px] rounded-md bg-coral px-7 text-body font-semibold text-ink"
          >
            {nav.next}
          </button>
        )}
      </div>
    </div>
  );
}
