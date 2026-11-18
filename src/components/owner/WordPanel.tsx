"use client";

import { useId, useState } from "react";
import { addGlossaryEntry, updateGlossaryEntry } from "@/lib/review/actions";
import type { GlossaryRow } from "@/lib/review/glossary";

const input = "h-[44px] w-full rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";

/** A tapped word: its glossary entry to correct, or a small form to add it. Learners see the entry's transliteration and meaning. */
export function WordPanel({
  videoId,
  word,
  entry,
  lang,
  dir,
  notice,
  onEntry,
  onClose,
}: {
  videoId: string;
  word: string;
  entry: GlossaryRow | undefined;
  lang: string;
  dir: "rtl" | "ltr";
  /** Said above the form, e.g. that the word was already there. */
  notice?: string;
  onEntry: (entry: GlossaryRow, notice?: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [transliteration, setTransliteration] = useState(entry?.transliteration ?? "");
  const [english, setEnglish] = useState(entry?.english ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [done, setDone] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    setDone(undefined);
    try {
      if (entry) {
        const result = await updateGlossaryEntry({ videoId, entryId: entry.id, transliteration, english });
        if (result.ok) {
          onEntry({ ...entry, transliteration: transliteration.trim(), english: english.trim() });
          setDone("Saved.");
        } else setMessage(result.message);
      } else {
        const result = await addGlossaryEntry({ videoId, word, transliteration, english });
        if (result.ok) {
          onEntry(result.entry);
          setDone("Added to the glossary.");
        } else if (result.kind === "exists" && result.entry) {
          onEntry(result.entry, result.message);
        } else setMessage(result.message);
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} aria-label={entry ? `Glossary entry for ${word}` : `Add ${word} to the glossary`} className="flex flex-col gap-space-3 rounded-lg border border-ink bg-paper p-space-4">
      <div className="flex items-center justify-between gap-space-3">
        <h3 className="m-0 flex items-baseline gap-space-3 font-display text-[18px] font-extrabold text-ink">
          <span lang={lang} dir={dir} className="font-naskh text-[26px] font-normal">
            {entry?.word ?? word}
          </span>
          <span>{entry ? "Glossary entry" : "Add to glossary"}</span>
        </h3>
        <button type="button" onClick={onClose} className="min-h-11 px-space-3 text-label underline">
          Close
        </button>
      </div>
      <div className="grid gap-space-3 md:grid-cols-2">
        <label htmlFor={`${uid}-t`} className="flex flex-col gap-1 text-label text-ink">
          Transliteration
          <input id={`${uid}-t`} value={transliteration} onChange={(e) => setTransliteration(e.target.value)} className={input} />
        </label>
        <label htmlFor={`${uid}-e`} className="flex flex-col gap-1 text-label text-ink">
          English
          <input id={`${uid}-e`} value={english} onChange={(e) => setEnglish(e.target.value)} className={input} />
        </label>
      </div>
      {notice && (
        <p role="status" className="m-0 text-label text-slate">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-space-3">
        <button type="submit" disabled={pending} className="min-h-11 rounded-md border-none bg-teal px-space-4 text-label font-semibold text-ink disabled:opacity-50">
          {entry ? "Save changes" : "Add to glossary"}
        </button>
        {done && (
          <span role="status" className="text-label text-slate">
            {done}
          </span>
        )}
        {message && (
          <span role="alert" className="text-label text-coral-text">
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
