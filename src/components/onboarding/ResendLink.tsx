"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/hooks/useStoredValue";
import { requestEmailLink } from "@/lib/auth/actions";
import { readLastEmail, type LastEmail } from "@/lib/auth/last-email";
import { signInPath } from "@/lib/routes";

const WAIT_SECONDS = 30;

/** "Send it again" for the Check your email page, available after a short wait and under the same send limits. */
export function ResendLink() {
  // Read after mount so the server render and the first client render match.
  const hydrated = useHydrated();
  const last = useMemo<LastEmail | null | undefined>(() => (hydrated ? (readLastEmail() ?? null) : undefined), [hydrated]);
  const [seconds, setSeconds] = useState(WAIT_SECONDS);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string>();

  const waiting = seconds > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  if (last === undefined) return null;
  if (last === null) {
    return (
      <Link href={signInPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        Back to sign in
      </Link>
    );
  }

  async function resend() {
    if (!last) return;
    setSending(true);
    setNote(undefined);
    try {
      const result = await requestEmailLink({ email: last.email, returnTo: last.returnTo });
      if (result.ok) {
        setNote("Sent again. It can take a minute to arrive.");
        setSeconds(WAIT_SECONDS);
      } else {
        setNote(
          result.code === "too-many"
            ? "Please wait a little before asking again."
            : "We couldn't send that just now. Please try again in a moment.",
        );
      }
    } catch {
      setNote("We couldn't send that just now. Please try again in a moment.");
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-space-2">
      <button
        type="button"
        onClick={resend}
        disabled={waiting || sending}
        className="min-h-11 self-start rounded-md border border-slate bg-paper px-space-6 text-label text-ink disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send it again"}
      </button>
      <p className="m-0 text-caption text-slate" role="status">
        {note ?? (waiting ? `You can ask for another in ${seconds} seconds.` : "")}
      </p>
    </div>
  );
}
