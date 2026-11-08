"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { addManualTime } from "@/lib/hours/actions";
import { hoursStore } from "@/lib/hours/store";
import { MAX_MINUTES } from "@/lib/hours/manual-time";

type Props = { languageCode: string; today: string };

const field =
  "min-h-11 rounded-md border border-slate bg-paper px-space-3 text-body text-ink";
const button =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-space-4 text-label";

const MESSAGES: Record<string, { field: "minutes" | "day" | "form"; text: string }> = {
  "invalid-minutes": { field: "minutes", text: `Enter a whole number of minutes, from 1 to ${MAX_MINUTES}.` },
  "invalid-date": { field: "day", text: "Pick today or an earlier date from the last year." },
  "too-many": { field: "form", text: "That day already has plenty of entries. Try another day." },
  "no-profile": { field: "form", text: "Add this language first, then come back." },
  invalid: { field: "form", text: "Something looks off. Check the minutes and the date." },
};

/** "Add time outside Instik": minutes and a date. The entry is always shown as added by the learner. */
export function AddTimeDialog({ languageCode, today }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [minutes, setMinutes] = useState("");
  const [day, setDay] = useState(today);
  const [errors, setErrors] = useState<{ minutes?: string; day?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  function open() {
    setErrors({});
    setDay(today);
    setMinutes("");
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }

  function close() {
    const d = dialog.current;
    if (d) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
    opener.current?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(minutes);
    setPending(true);
    try {
      let timeZone = "UTC";
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        // keep UTC
      }
      const result = await addManualTime({
        languageCode,
        minutes: minutes.trim() === "" ? Number.NaN : value,
        day,
        timeZone,
      });
      if (result.ok) {
        hoursStore.set(languageCode, result.totalSeconds);
        close();
        router.refresh();
      } else {
        const m = MESSAGES[result.code] ?? MESSAGES.invalid;
        setErrors({ [m.field]: m.text });
      }
    } catch {
      setErrors({ form: "Couldn't save that just now. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={open}
        className={`${button} border border-slate bg-paper font-semibold text-ink`}
      >
        Add time outside Instik
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        className="m-auto w-[min(92vw,420px)] rounded-lg border-0 bg-paper p-space-6 text-ink shadow-md backdrop:bg-ink/40"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-space-4">
          <h2 id={`${id}-title`} className="m-0 font-display text-heading text-ink">
            Add time outside Instik
          </h2>
          <p className="m-0 text-label font-normal text-slate">It will show as added by you.</p>

          <div className="flex flex-col gap-space-1">
            <label htmlFor={`${id}-minutes`} className="text-label text-ink">
              Minutes
            </label>
            <input
              id={`${id}-minutes`}
              inputMode="numeric"
              autoComplete="off"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={errors.minutes ? true : undefined}
              aria-describedby={errors.minutes ? `${id}-minutes-error` : undefined}
              className={field}
            />
            {errors.minutes ? (
              <p id={`${id}-minutes-error`} role="alert" className="m-0 text-caption text-coral-text">
                {errors.minutes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-space-1">
            <label htmlFor={`${id}-day`} className="text-label text-ink">
              Date
            </label>
            <input
              id={`${id}-day`}
              type="date"
              value={day}
              max={today}
              onChange={(e) => setDay(e.target.value)}
              aria-invalid={errors.day ? true : undefined}
              aria-describedby={errors.day ? `${id}-day-error` : undefined}
              className={field}
            />
            {errors.day ? (
              <p id={`${id}-day-error`} role="alert" className="m-0 text-caption text-coral-text">
                {errors.day}
              </p>
            ) : null}
          </div>

          {errors.form ? (
            <p role="alert" className="m-0 text-caption text-coral-text">
              {errors.form}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-space-3">
            <button type="button" onClick={close} className={`${button} border-0 bg-transparent font-semibold text-ink underline`}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={`${button} border-0 bg-coral font-semibold text-ink`}>
              {pending ? "Adding…" : "Add time"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
