"use client";

import { ChoiceGroup } from "./ChoiceGroup";
import { DEFAULT_MINUTES, type Minutes } from "@/lib/learner/profile-rules";
import { timeStep } from "@/lib/onboarding/copy";

type Props = { value: Minutes | undefined; onChoose: (minutes: Minutes) => void };

/** Step 3. Exactly one of 10, 20, 30 or 60 minutes; 20 is shown selected until the learner chooses. */
export function TimeStep({ value, onChoose }: Props) {
  return (
    <ChoiceGroup
      label={timeStep.groupLabel}
      value={value ?? DEFAULT_MINUTES}
      onChange={onChoose}
      className="grid grid-cols-4 gap-space-3"
      cardClassName="h-[72px] justify-center px-space-2 text-body-lg font-semibold"
      options={timeStep.options.map((o) => ({ id: o.id, content: <span>{o.label}</span> }))}
    />
  );
}
