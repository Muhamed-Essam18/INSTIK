"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { markPaid } from "@/lib/earnings/actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60";

/** Marks one creator as paid for a closed month, with a reference (like the bank transfer number). The amount is the closed month's own: it is never typed. */
export function MarkPaidButton({ month, creatorId, name }: { month: string; creatorId: string; name: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(form: HTMLFormElement) {
    const reference = String(new FormData(form).get("reference") ?? "");
    setPending(true);
    setMessage(undefined);
    try {
      const result = await markPaid({ month, creatorId, reference });
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
      <button type="button" onClick={() => setOpen(true)} aria-label={`Mark ${name} as paid`} className={button}>
        Mark as paid
      </button>
    );
  }
  return (
    <form
      aria-label={`Mark ${name} as paid`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex max-w-[280px] flex-col gap-space-2"
    >
      <label htmlFor={fieldId} className="text-caption text-slate">
        Reference, like the bank transfer number
      </label>
      <input id={fieldId} name="reference" type="text" maxLength={120} autoComplete="off" className="min-h-11 rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink" />
      <div className="flex flex-wrap gap-space-2">
        <button type="submit" disabled={pending} className={`${button} bg-coral font-semibold`}>
          Save payment
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
