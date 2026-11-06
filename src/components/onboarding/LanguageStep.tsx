"use client";

import Link from "next/link";
import { ChoiceGroup } from "./ChoiceGroup";
import type { Language } from "@/lib/languages.schema";
import { languagesToOffer } from "@/lib/learner/profile-rules";
import { languageStep } from "@/lib/onboarding/copy";

const rowClass = "flex items-center gap-space-4 rounded-lg bg-paper/50 px-space-6 py-space-4 text-slate";

export const languageName = (l: Language) => [l.variety, l.name].filter(Boolean).join(" ");

type Props = { languages: readonly Language[]; value: string | undefined; onChoose: (code: string) => void };

/** Step 1. Available languages can be chosen; the rest show "Join the waitlist". Choosing one moves on. */
export function LanguageStep({ languages, value, onChoose }: Props) {
  const offers = languagesToOffer(languages, []);
  const available = offers.filter((o) => o.state === "available");
  const later = offers.filter((o) => o.state !== "available");
  return (
    <div className="flex flex-col gap-space-3">
      <ChoiceGroup
        label="Language"
        value={value}
        onChange={onChoose}
        options={available.map(({ language }) => ({
          id: language.code,
          content: (
            <>
              <span className="flex grow flex-col">
                <span className="text-heading font-semibold">{languageName(language)}</span>
                {language.description && <span className="text-label font-normal text-slate">{language.description}</span>}
              </span>
              <span className="rounded-pill bg-teal px-space-3 py-1.5 text-caption font-semibold text-ink">
                {languageStep.available}
              </span>
            </>
          ),
        }))}
      />
      {later.map(({ language }) => (
        <div key={language.code} className={rowClass}>
          <span className="flex grow flex-col">
            <span className="text-heading font-semibold text-ink">{languageName(language)}</span>
            <span className="text-label">{languageStep.comingLater}</span>
          </span>
          <Link href={languageStep.waitlistHref} className="inline-flex min-h-11 items-center text-label underline">
            {languageStep.waitlist}
          </Link>
        </div>
      ))}
      <div className={rowClass}>
        <span className="flex grow flex-col">
          <span className="text-heading font-semibold text-ink">{languageStep.somethingElse.name}</span>
          <span className="text-label">{languageStep.somethingElse.note}</span>
        </span>
        <Link href={languageStep.waitlistHref} className="inline-flex min-h-11 items-center text-label underline">
          {languageStep.waitlist}
        </Link>
      </div>
    </div>
  );
}
