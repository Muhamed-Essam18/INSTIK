"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { closeMonth } from "@/lib/earnings/actions";
import { CLOSE_CONFIRM } from "@/lib/earnings/messages";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60";

/**
 * Closes the month after a calm confirmation that says it locks the numbers. Disabled, with the reason beside it, until the month has ended
 * and its revenue has been entered. Safe to press twice: the second close changes nothing.
 */
export function CloseMonthButton({ month, monthLabel, ended, revenueEntered }: { month: string; monthLabel: string; ended: boolean; revenueEntered: boolean }) {
  const router = useRouter();
  const noteId = useId();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  const reason = !ended ? "You can close this month once it has ended." : !revenueEntered ? "Enter this month's revenue first." : undefined;

  async function run() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await closeMonth({ month });
      if (!result.ok) setMessage(result.message);
      else setConfirming(false);
      router.refresh();
    } catch {
      setMessage("That didn't go through. Please try again.");
    }
    setPending(false);
  }

  if (!confirming) {
    return (
      <div className="flex flex-wrap items-center gap-space-3">
        <button type="button" onClick={() => setConfirming(true)} disabled={reason !== undefined} aria-describedby={reason ? noteId : undefined} className={button}>
          Close {monthLabel}
        </button>
        {reason && (
          <span id={noteId} className="text-caption text-slate">
            {reason}
          </span>
        )}
        {message && (
          <span role="alert" className="text-caption text-coral-text">
            {message}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex max-w-[420px] flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-4">
      <p id={noteId} className="m-0 text-body text-ink">
        {CLOSE_CONFIRM(monthLabel)}
      </p>
      <div className="flex flex-wrap gap-space-2">
        <button type="button" onClick={run} disabled={pending} aria-describedby={noteId} className={`${button} bg-coral font-semibold`}>
          Close month
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-space-3 text-label underline">
          Cancel
        </button>
      </div>
      {message && (
        <span role="alert" className="text-caption text-coral-text">
          {message}
        </span>
      )}
    </div>
  );
}
