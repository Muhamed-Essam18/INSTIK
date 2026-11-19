"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { reversePayout } from "@/lib/earnings/actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60";

/** Undoes one payment by adding a reversing record, with the reason. The payment stays in the history; the creator can then be marked paid again. */
export function UndoPaymentButton({ payoutId, creatorId, name }: { payoutId: string; creatorId: string; name: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(form: HTMLFormElement) {
    const reason = String(new FormData(form).get("reason") ?? "");
    setPending(true);
    setMessage(undefined);
    try {
      const result = await reversePayout({ payoutId, creatorId, reason });
      if (!result.ok) setMessage(result.message);
      else setOpen(false);
      router.refresh();
    } catch {
      setMessage("That didn't go through. Please try again.");
    }
    setPending(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`Undo the payment to ${name}`} className={button}>
        Undo payment
      </button>
    );
  }
  return (
    <form
      aria-label={`Undo the payment to ${name}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex max-w-[280px] flex-col gap-space-2"
    >
      <label htmlFor={fieldId} className="text-caption text-slate">
        Why is it being undone?
      </label>
      <input id={fieldId} name="reason" type="text" maxLength={120} autoComplete="off" className="min-h-11 rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink" />
      <div className="flex flex-wrap gap-space-2">
        <button type="submit" disabled={pending} className={`${button} bg-coral font-semibold`}>
          Undo payment
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-space-3 text-label underline">
          Cancel
        </button>
      </div>
      {message && (
        <span role="alert" className="text-caption text-coral-text">
          {message}
        </span>
      )}
    </form>
  );
}
