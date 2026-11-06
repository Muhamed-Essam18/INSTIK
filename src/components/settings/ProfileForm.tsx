"use client";

import { useState } from "react";
import { ChoiceGroup } from "@/components/onboarding/ChoiceGroup";
import { updateProfile } from "@/lib/learner/actions";
import { MINUTES, STAGES, STAGE_NAMES, isValidMinutes, type Profile } from "@/lib/learner/profile-rules";

type Props = { languageName: string; profile: Profile };

/** Change the stage and usual minutes per day of one language profile. Other languages are never touched. */
export function ProfileForm({ languageName, profile }: Props) {
  const [stage, setStage] = useState(profile.stage);
  const [minutes, setMinutes] = useState(profile.minutesPerDay);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      const result = await updateProfile({ languageCode: profile.languageCode, stage, minutesPerDay: minutes });
      setStatus(result.ok ? "saved" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-space-6 rounded-lg bg-paper/60 p-space-6">
      <h2 className="m-0 font-display text-heading text-ink">{languageName}</h2>
      <div className="flex flex-col gap-space-2">
        <p className="m-0 text-label text-ink">Where you are</p>
        <ChoiceGroup
          label={`${languageName} stage`}
          value={stage}
          onChange={(s) => {
            setStage(s);
            setStatus("idle");
          }}
          className="grid grid-cols-2 gap-space-3"
          cardClassName="px-space-4 py-space-3 text-body font-semibold"
          options={STAGES.map((s) => ({ id: s, content: <span className="grow">{STAGE_NAMES[s]}</span> }))}
        />
      </div>
      <div className="flex flex-col gap-space-2">
        <p className="m-0 text-label text-ink">Minutes on a usual day</p>
        <ChoiceGroup
          label={`${languageName} minutes per day`}
          value={isValidMinutes(minutes) ? minutes : undefined}
          onChange={(m) => {
            setMinutes(m);
            setStatus("idle");
          }}
          className="grid grid-cols-4 gap-space-3"
          cardClassName="h-14 justify-center px-space-2 text-body font-semibold"
          options={MINUTES.map((m) => ({ id: m, content: <span>{m} min</span> }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-space-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="h-[52px] rounded-md bg-coral px-7 text-body font-semibold text-ink disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <p role={status === "failed" ? "alert" : "status"} className="m-0 text-label text-slate">
          {status === "saved" && "Saved."}
          {status === "failed" && "We couldn't save that just now. Your choices are still here. Please try again."}
        </p>
      </div>
    </form>
  );
}
