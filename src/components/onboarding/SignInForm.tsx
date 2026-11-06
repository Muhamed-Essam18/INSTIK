"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { requestEmailLink, signInWithGoogle } from "@/lib/auth/actions";
import { parseEmail } from "@/lib/auth/email";
import { rememberLastEmail } from "@/lib/auth/last-email";

type Props = {
  /** Where to go after signing in; checked again on the server. */
  returnTo?: string;
  submitLabel?: string;
};

const messages = {
  invalid: "That doesn't look like an email address. Try something like you@example.com.",
  "too-many": "Please wait a little before asking again.",
  failed: "We couldn't send that just now. Please try again in a moment.",
  google: "We couldn't sign you in with Google. Try again, or use an email link.",
} as const;

/** Google button and email-link form: the only two ways in. */
export function SignInForm({ returnTo, submitLabel = "Send me a link" }: Props) {
  const router = useRouter();
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const clean = parseEmail(email);
    if (!clean) {
      setError(messages.invalid);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const result = await requestEmailLink({ email: clean, returnTo });
      if (result.ok) {
        rememberLastEmail({ email: clean, returnTo });
        router.push("/sign-in/check-email");
        return;
      }
      setError(result.code === "invalid-email" ? messages.invalid : messages[result.code]);
    } catch {
      setError(messages.failed);
    }
    setPending(false);
  }

  async function google() {
    setError(undefined);
    setPending(true);
    try {
      await signInWithGoogle({ returnTo });
    } catch (e) {
      // A redirect to Google is thrown on purpose and must be allowed through.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      setError(messages.google);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-6">
      <button
        type="button"
        onClick={google}
        disabled={pending}
        className="h-14 rounded-md border border-slate bg-paper text-body font-semibold text-ink disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-space-3 text-label text-slate" aria-hidden="true">
        <span className="h-px grow bg-hairline" />
        or
        <span className="h-px grow bg-hairline" />
      </div>

      <form onSubmit={sendLink} noValidate className="flex flex-col gap-space-4">
        <label htmlFor={emailId} className="flex flex-col gap-1.5 text-label text-ink">
          Email
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-[52px] rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink"
          />
        </label>
        {error && (
          <p id={errorId} role="alert" className="m-0 text-label text-coral-text">
            {error}
          </p>
        )}
        <p className="m-0 text-caption text-slate">We&apos;ll send you a sign-in link. No password to remember.</p>
        <button
          type="submit"
          disabled={pending}
          className="h-[52px] self-start rounded-md bg-coral px-7 text-body font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Sending…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
