"use client";

import Link from "next/link";
import { ChoiceGroup } from "@/components/onboarding/ChoiceGroup";
import { languageName } from "@/components/onboarding/LanguageStep";
import type { OfferState } from "@/lib/learner/profile-rules";
import type { Language } from "@/lib/languages.schema";
import { languageStep } from "@/lib/onboarding/copy";

type Props = {
  offers: ReadonlyArray<{ language: Language; state: OfferState }>;
  value: string | undefined;
  onChoose: (code: string) => void;
};

const rowClass = "flex items-center gap-space-4 rounded-lg bg-paper/50 px-space-6 py-space-4 text-slate";

/** Available languages the learner does not have are choices; ones they have show "Added"; the rest, the waitlist. */
export function AddLanguageList({ offers, value, onChoose }: Props) {
  const choices = offers.filter((o) => o.state === "available");
  return (
    <div className="flex flex-col gap-space-3">
      {choices.length > 0 && (
        <ChoiceGroup
          label="Language to add"
          value={value}
          onChange={onChoose}
          options={choices.map(({ language }) => ({
            id: language.code,
            content: (
              <span className="flex grow flex-col">
                <span className="text-heading font-semibold">{languageName(language)}</span>
                {language.description && <span className="text-label font-normal text-slate">{language.description}</span>}
              </span>
            ),
          }))}
        />
      )}
      {offers
        .filter((o) => o.state !== "available")
        .map(({ language, state }) => (
          <div key={language.code} className={rowClass}>
            <span className="flex grow flex-col">
              <span className="text-heading font-semibold text-ink">{languageName(language)}</span>
              <span className="text-label">{state === "added" ? "Added" : languageStep.comingLater}</span>
            </span>
            {state === "waitlist" && (
              <Link href={languageStep.waitlistHref} className="inline-flex min-h-11 items-center text-label underline">
                {languageStep.waitlist}
              </Link>
            )}
          </div>
        ))}
      {choices.length === 0 && (
        <p className="m-0 text-body text-slate">There&apos;s nothing new to add yet. Join the waitlist for what&apos;s next.</p>
      )}
    </div>
  );
}
