"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { waitlist } from "@/lib/marketing/copy";
import { privacyPath } from "@/lib/routes";
import type { WaitlistOption } from "@/lib/waitlist/options";
import type { JoinWaitlistResult } from "@/lib/waitlist/actions";

type Props = {
  options: readonly WaitlistOption[];
  join: (input: { language: unknown; email: unknown; website?: unknown }) => Promise<JoinWaitlistResult>;
};

const fieldClass =
  "h-12 rounded-sm border border-slate bg-paper px-3 font-normal text-ink";

/** Language, email and a hidden trap field. Keeps what was typed when something goes wrong. */
export function WaitlistForm({ options, join }: Props) {
  const requested = useSearchParams().get("language");
  const initial = options.some((o) => o.code === requested) ? (requested as string) : "";
  const [language, setLanguage] = useState(initial);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [result, setResult] = useState<JoinWaitlistResult | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = { language: useId(), email: useId(), error: useId() };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      setResult(await join({ language, email, website }));
    });
  }

  if (result?.ok) {
    return (
      <p role="status" className="rounded-md bg-coral-tint p-4 text-[17px] leading-[26px]">
        {waitlist.success}
      </p>
    );
  }

  const error = result && !result.ok ? waitlist.errors[result.code] : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={ids.language} className="flex min-w-[200px] flex-[1_1_200px] flex-col gap-1.5 text-label">
          {waitlist.languageLabel}
          <select
            id={ids.language}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-describedby={error ? ids.error : undefined}
            className={fieldClass}
          >
            <option value="">{waitlist.languagePlaceholder}</option>
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={ids.email} className="flex min-w-[240px] flex-[2_1_240px] flex-col gap-1.5 text-label">
          {waitlist.emailLabel}
          <input
            id={ids.email}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder={waitlist.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? ids.error : undefined}
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-md bg-ink px-[22px] font-semibold text-cream disabled:opacity-70"
        >
          {pending ? waitlist.sending : waitlist.button}
        </button>
      </div>

      {/* Hidden from people and from assistive technology; a robot that fills it is quietly ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <p className="text-caption text-slate">
        {waitlist.note}{" "}
        <Link href={privacyPath()} className="underline">
          {waitlist.privacyLink}
        </Link>
      </p>
      {error && (
        <p id={ids.error} role="alert" className="text-label text-coral-text">
          {error}
        </p>
      )}
    </form>
  );
}
