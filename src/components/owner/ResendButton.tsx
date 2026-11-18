"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resendInvite } from "@/lib/invites/actions";

/** Sends someone a fresh invitation link. The earlier link stops working and the 7 days start again. */
export function ResendButton({ email, name }: { email: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [sent, setSent] = useState(false);

  async function resend() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await resendInvite(email);
      if (result.ok) setSent(true);
      else setMessage(result.message);
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        aria-label={`Resend the invitation to ${name}`}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60"
      >
        Resend
      </button>
      {sent && (
        <span role="status" className="text-caption text-slate">
          Sent again.
        </span>
      )}
      {message && (
        <span role="alert" className="text-caption text-coral-text">
          {message}
        </span>
      )}
    </span>
  );
}
