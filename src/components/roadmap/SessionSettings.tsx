"use client";

import { useId, useState } from "react";
import { SaveNote } from "@/components/watch/SaveNote";
import { saveSessionSettings } from "@/lib/hours/settings-actions";
import { updateProfile } from "@/lib/learner/actions";
import { MINUTES } from "@/lib/learner/profile-rules";

type Props = { languageCode: string; minutesPerDay: number; remindersOn: boolean; hourSound: boolean };

function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center gap-space-3">
      <span className="flex grow flex-col">
        <span className="text-label text-ink">{label}</span>
        <span className="text-label font-normal text-slate">{hint}</span>
      </span>
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`flex h-11 w-[52px] shrink-0 cursor-pointer items-center rounded-pill border-0 p-1 ${on ? "justify-end bg-teal" : "justify-start bg-slate"}`}
      >
        <span aria-hidden="true" className="block size-6 rounded-pill bg-paper" />
      </button>
    </div>
  );
}

/** "Your sessions": minutes per day, reminders (off by default, nothing is sent yet) and the soft hour chime. */
export function SessionSettings({ languageCode, minutesPerDay, remindersOn, hourSound }: Props) {
  const id = useId();
  const [minutes, setMinutes] = useState(minutesPerDay);
  const [reminders, setReminders] = useState(remindersOn);
  const [sound, setSound] = useState(hourSound);
  const [failed, setFailed] = useState(false);

  async function run(save: () => Promise<{ ok: boolean }>, rollback: () => void) {
    setFailed(false);
    try {
      const result = await save();
      if (!result.ok) throw new Error("not saved");
    } catch {
      rollback();
      setFailed(true);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-[1_1_320px] flex-col gap-space-6 rounded-lg bg-paper p-space-8">
      <h2 id={`${id}-title`} className="m-0 font-display text-[26px] leading-8 font-extrabold text-ink">
        Your sessions
      </h2>

      <div className="flex items-center gap-space-3">
        <span className="flex grow flex-col">
          <label htmlFor={`${id}-minutes`} className="text-label text-ink">
            Done for today after
          </label>
          <span className="text-label font-normal text-slate">We&apos;ll tell you when to stop</span>
        </span>
        <select
          id={`${id}-minutes`}
          value={minutes}
          onChange={(e) => {
            const next = Number(e.target.value);
            const previous = minutes;
            setMinutes(next);
            void run(() => updateProfile({ languageCode, minutesPerDay: next }), () => setMinutes(previous));
          }}
          className="min-h-11 rounded-md border border-slate bg-paper px-space-3 text-label text-ink"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </div>

      <Switch
        label="Reminders"
        hint="Rare and friendly. Off by default."
        on={reminders}
        onChange={(next) => {
          setReminders(next);
          void run(() => saveSessionSettings({ remindersOn: next }), () => setReminders(!next));
        }}
      />

      <Switch
        label="Sound when an hour is added"
        hint="One soft chime"
        on={sound}
        onChange={(next) => {
          setSound(next);
          void run(() => saveSessionSettings({ hourSound: next }), () => setSound(!next));
        }}
      />

      <SaveNote show={failed} />
    </section>
  );
}
