"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { removeAccess } from "@/lib/grants/actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60";

/** Removes a grant an owner made, with an optional note. The account's own paid subscription, if it has one, is not touched. */
export function RemoveGrantButton({ email }: { email: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(form: HTMLFormElement) {
    const note = String(new FormData(form).get("note") ?? "");
    setPending(true);
    setMessage(undefined);
    try {
      const result = await removeAccess({ email, note });
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
      <button type="button" onClick={() => setOpen(true)} aria-label={`Remove Full access for ${email}`} className={button}>
        Remove
      </button>
    );
  }
  return (
    <form
      aria-label={`Remove Full access for ${email}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex max-w-[280px] flex-col gap-space-2"
    >
      <label htmlFor={fieldId} className="text-caption text-slate">
        Note (optional)
      </label>
      <input id={fieldId} name="note" type="text" maxLength={200} autoComplete="off" className="min-h-11 rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink" />
      <div className="flex flex-wrap gap-space-2">
        <button type="submit" disabled={pending} className={`${button} bg-coral font-semibold`}>
          Remove Full access
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
