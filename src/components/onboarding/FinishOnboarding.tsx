"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useStoredValue";
import type { Language } from "@/lib/languages.schema";
import { completeOnboarding } from "@/lib/learner/actions";
import { toProfileInput } from "@/lib/onboarding/draft";
import { clearDraft, readDraft } from "@/lib/onboarding/draft-storage";
import { libraryPath, onboardingPath } from "@/lib/routes";

type Props = {
  languages: readonly Language[];
  /** Profiles the learner already has, as language codes. */
  existingCodes: readonly string[];
  /** A checked return address, when the learner was going somewhere; otherwise the Library of the chosen language. */
  returnTo?: string;
};

type Phase =
  | { kind: "working" }
  | { kind: "exists"; input: NonNullable<ReturnType<typeof toProfileInput>> }
  | { kind: "error" };

const buttonClass = "h-[52px] rounded-md px-7 text-body font-semibold text-ink";

/**
 * The step after signing in: turns the choices kept on this device into the learner's profile, then sends them on.
 * An existing profile for the same language is never replaced without asking.
 */
export function FinishOnboarding({ languages, existingCodes, returnTo }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const codes = languages.map((l) => l.code);

  const destination = (languageCode: string) => {
    const slug = languages.find((l) => l.code === languageCode)?.slug;
    return returnTo ?? (slug ? libraryPath(slug) : "/");
  };

  async function save(input: NonNullable<ReturnType<typeof toProfileInput>>, replaceExisting: boolean) {
    try {
      const result = await completeOnboarding({ ...input, replaceExisting });
      if (result.ok) {
        clearDraft();
        router.replace(destination(input.languageCode));
      } else if (result.code === "exists") {
        setPhase({ kind: "exists", input });
      } else {
        setPhase({ kind: "error" });
      }
    } catch {
      setPhase({ kind: "error" });
    }
  }

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    const draft = readDraft(codes);
    const input = toProfileInput(draft);
    if (input) {
      // Started from a microtask so the page can render "Setting things up…" first.
      queueMicrotask(() => void save(input, false));
    } else if (existingCodes.length > 0) {
      // A returning learner with nothing to carry over.
      router.replace(returnTo ?? libraryPath(languages.find((l) => l.code === existingCodes[0])?.slug ?? ""));
    } else {
      // Another device, or nothing chosen yet: ask the questions once.
      router.replace(onboardingPath(returnTo));
    }
    // Runs once, after the device has been read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (phase.kind === "exists") {
    const { input } = phase;
    return (
      <div className="flex flex-col gap-space-4">
        <h1 className="m-0 font-display text-title text-ink">You already have this language</h1>
        <p className="m-0 text-body-lg text-slate">Keep your current choices, or use these?</p>
        <div className="flex flex-wrap gap-space-3">
          <button
            type="button"
            className={`${buttonClass} border border-slate bg-paper`}
            onClick={() => {
              clearDraft();
              router.replace(destination(input.languageCode));
            }}
          >
            Keep mine
          </button>
          <button type="button" className={`${buttonClass} bg-coral`} onClick={() => {
              setPhase({ kind: "working" });
              void save(input, true);
            }}>
            Use these
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="flex flex-col gap-space-4">
        <h1 className="m-0 font-display text-title text-ink">That didn&apos;t quite work</h1>
        <p role="alert" className="m-0 text-body-lg text-slate">
          We couldn&apos;t save your choices just now. Nothing is lost. Please try again.
        </p>
        <button
          type="button"
          className={`${buttonClass} self-start bg-coral`}
          onClick={() => {
            const input = toProfileInput(readDraft(codes));
            if (input) {
              setPhase({ kind: "working" });
              void save(input, false);
            }
            else router.replace(onboardingPath(returnTo));
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <p role="status" className="m-0 text-body-lg text-slate">
      Setting things up…
    </p>
  );
}
