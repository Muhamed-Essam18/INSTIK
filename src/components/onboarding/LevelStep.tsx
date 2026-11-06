"use client";

import { useState } from "react";
import { ChoiceGroup } from "./ChoiceGroup";
import { DEFAULT_LEVEL, type Level } from "@/lib/learner/profile-rules";
import { levelStep } from "@/lib/onboarding/copy";

type Props = { value: Level | undefined; onChoose: (level: Level) => void };

/** Step 2. The listening check is optional, never blocks Continue and never changes the level. */
export function LevelStep({ value, onChoose }: Props) {
  const [checkOpen, setCheckOpen] = useState(false);
  return (
    <div className="flex flex-col gap-space-6">
      <ChoiceGroup
        label={levelStep.groupLabel}
        value={value ?? DEFAULT_LEVEL}
        onChange={onChoose}
        options={levelStep.options.map((o) => ({
          id: o.id,
          content: (
            <>
              <span className="flex grow flex-col">
                <span className="text-body-lg font-semibold">{o.title}</span>
                <span className="text-label font-normal text-slate">{o.sub}</span>
              </span>
              <span className="text-caption font-semibold text-teal-text">{o.stage}</span>
            </>
          ),
        }))}
      />
      <p className="m-0 text-translit text-slate">
        {levelStep.checkLead}{" "}
        <button
          type="button"
          aria-expanded={checkOpen}
          onClick={() => setCheckOpen((o) => !o)}
          className="min-h-11 font-semibold text-ink underline"
        >
          {levelStep.checkLink}
        </button>
        . {levelStep.checkTail}
      </p>
      {checkOpen && (
        <p role="status" className="m-0 rounded-md bg-coral-tint p-space-4 text-label text-ink">
          {levelStep.checkSoon}
        </p>
      )}
    </div>
  );
}
