"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { addAdjustment } from "@/lib/earnings/actions";

const input = "min-h-11 w-full rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink";

/**
 * A signed correction for this open month, usually for an earlier closed one (a late refund). It changes the month's net revenue before the
 * 80/20 split. Entries are never edited: a mistake is cancelled with an opposite entry.
 */
export function AdjustmentForm({ month }: { month: string }) {
  const router = useRouter();
  const hintId = useId();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setMessage(undefined);
    try {
      const result = await addAdjustment({ month, amount: String(data.get("amount") ?? ""), note: String(data.get("note") ?? "") });
      if (result.ok) form.reset();
      setMessage(result.ok ? { ok: true, text: "Added." } : { ok: false, text: result.message });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "That didn't go through. Please try again." });
    }
    setPending(false);
  }

  return (
    <form
      aria-label="Add an adjustment"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-6"
    >
      <h3 className="m-0 font-display text-heading text-ink">Adjustments</h3>
      <p id={hintId} className="m-0 text-caption text-slate">
        A correction for an earlier closed month, like a late refund. Use a minus for money taken off. It is shared 80/20 with this month&apos;s revenue.
      </p>
      <div className="grid gap-space-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-space-1 text-label text-ink">
          Amount in euros
          <input name="amount" type="text" inputMode="decimal" autoComplete="off" aria-describedby={hintId} className={input} />
        </label>
        <label className="flex flex-col gap-space-1 text-label text-ink">
          Note: which month it corrects and why
          <input name="note" type="text" maxLength={200} autoComplete="off" className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-space-4">
        <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60">
          Add adjustment
        </button>
        {message && (
          <span role={message.ok ? "status" : "alert"} className={`text-label ${message.ok ? "text-teal-text" : "text-coral-text"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
