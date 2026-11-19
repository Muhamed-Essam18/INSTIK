"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { stages, topics } from "@/lib/content/taxonomy";
import { createRequest } from "@/lib/requests/actions";
import { MAX_TEXT } from "@/lib/requests/service";

const input = "min-h-11 w-full rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink";

/** Writes a request that every creator sees on their dashboard: a stage, a topic and a sentence or two (up to 200 characters). */
export function RequestForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setMessage(undefined);
    try {
      const result = await createRequest({ stage: String(data.get("stage") ?? ""), topic: String(data.get("topic") ?? ""), text: String(data.get("text") ?? "") });
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
      aria-label="Write a request"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6"
    >
      <div className="grid gap-space-4 sm:grid-cols-2">
        <label className="flex flex-col gap-space-1 text-label text-ink">
          Stage
          <select name="stage" defaultValue="" className={input}>
            <option value="" disabled>
              Choose a stage
            </option>
            {stages.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-space-1 text-label text-ink">
          Topic
          <select name="topic" defaultValue="" className={input}>
            <option value="" disabled>
              Choose a topic
            </option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-space-1 text-label text-ink">
        What would help learners?
        <input name="text" type="text" maxLength={MAX_TEXT} autoComplete="off" className={input} aria-describedby="request-hint" />
      </label>
      <p id="request-hint" className="m-0 text-caption text-slate">
        A sentence or two, up to {MAX_TEXT} characters. Every creator will see it.
      </p>
      <div className="flex flex-wrap items-center gap-space-4">
        <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-md bg-coral px-space-6 text-label font-semibold text-ink disabled:opacity-60">
          Post request
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
