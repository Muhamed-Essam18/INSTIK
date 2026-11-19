"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { grantAccess } from "@/lib/grants/actions";
import { reasonLabel } from "@/lib/grants/messages";
import type { GrantReason } from "@/lib/grants/service";

const input = "min-h-11 w-full rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink";
const reasons = Object.keys(reasonLabel) as GrantReason[];

/** Gives an existing account Full access by hand, with a reason and an optional note. The account is found by the email typed here. */
export function GrantForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setMessage(undefined);
    try {
      const result = await grantAccess({ email: String(data.get("email") ?? ""), reason: String(data.get("reason") ?? ""), note: String(data.get("note") ?? "") });
      if (result.ok) form.reset();
      setMessage({ ok: result.ok, text: result.message });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "That didn't go through. Please try again." });
    }
    setPending(false);
  }

  return (
    <form
      aria-label="Give Full access"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6"
    >
      <p className="m-0 text-caption text-slate">
        For testing, creators or gifts. The account has Full access straight away, and its watching counts toward creators&apos; views like a paying learner&apos;s.
      </p>
      <div className="grid gap-space-4 sm:grid-cols-2">
        <label className="flex flex-col gap-space-1 text-label text-ink">
          Email of the account
          <input name="email" type="email" autoComplete="off" className={input} />
        </label>
        <label className="flex flex-col gap-space-1 text-label text-ink">
          Why
          <select name="reason" defaultValue="TESTING" className={input}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {reasonLabel[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-space-1 text-label text-ink">
        Note (optional)
        <input name="note" type="text" maxLength={200} autoComplete="off" className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-space-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-coral px-space-6 text-label font-semibold text-ink disabled:opacity-60"
        >
          Give Full access
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
