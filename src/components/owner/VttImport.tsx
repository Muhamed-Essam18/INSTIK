"use client";

import { useId, useState } from "react";
import { importVtt, previewVtt } from "@/lib/review/actions";
import { formatTime } from "@/lib/review/segments";

type Preview = { count: number; first: number; last: number } | null;

/** Import a .vtt file: read it here, show a summary (nothing is written), then Add or Replace in one step. */
export function VttImport({ videoId, onImported }: { videoId: string; onImported: () => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [preview, setPreview] = useState<Preview>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  function reset() {
    setText(undefined);
    setFileName(undefined);
    setPreview(null);
    setProblems([]);
    setMessage(undefined);
  }

  async function pick(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    setPending(true);
    try {
      const content = await file.text();
      setText(content);
      const result = await previewVtt({ videoId, text: content });
      if (result.ok) setPreview({ count: result.count, first: result.first, last: result.last });
      else {
        setProblems(result.problems ?? []);
        if (!result.problems?.length) setMessage(result.message);
      }
    } catch {
      setMessage("We couldn't read that file.");
    }
    setPending(false);
  }

  async function run() {
    if (text === undefined) return;
    setPending(true);
    setMessage(undefined);
    try {
      const result = await importVtt({ videoId, text, mode });
      if (result.ok) {
        reset();
        setOpen(false);
        onImported();
      } else {
        setProblems(result.problems ?? []);
        setMessage(result.problems?.length ? undefined : result.message);
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-md border border-slate bg-paper px-space-4 text-label text-ink">
        Import .vtt
      </button>
    );
  }
  return (
    <section aria-label="Import a .vtt file" className="flex w-full flex-col gap-space-3 rounded-lg border border-ink bg-paper p-space-4">
      <label htmlFor={`${uid}-file`} className="flex flex-col gap-1 text-label text-ink">
        Choose a .vtt file
        <input id={`${uid}-file`} type="file" accept=".vtt,text/vtt" onChange={(e) => void pick(e.target.files?.[0])} className="min-h-11 text-body font-normal" />
      </label>
      {preview && (
        <div className="flex flex-col gap-space-3">
          <p role="status" className="m-0 text-body text-ink">
            {fileName}: {preview.count} {preview.count === 1 ? "segment" : "segments"}, from {formatTime(preview.first)} to {formatTime(preview.last)}.
          </p>
          <fieldset className="m-0 flex flex-col gap-space-1 border-0 p-0">
            <legend className="text-label text-ink">What should happen to the transcript you have now?</legend>
            <label className="flex min-h-11 items-center gap-space-3 text-body">
              <input type="radio" name={`${uid}-mode`} checked={mode === "add"} onChange={() => setMode("add")} className="size-5 accent-teal" />
              Add these to it
            </label>
            <label className="flex min-h-11 items-center gap-space-3 text-body">
              <input type="radio" name={`${uid}-mode`} checked={mode === "replace"} onChange={() => setMode("replace")} className="size-5 accent-teal" />
              Replace it with these
            </label>
          </fieldset>
        </div>
      )}
      {problems.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 text-label text-coral-text">
          <p className="m-0">Nothing was imported. Please fix these first:</p>
          <ul className="m-0 pl-space-4 font-normal">
            {problems.slice(0, 8).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {problems.length > 8 && <li>…and {problems.length - 8} more</li>}
          </ul>
        </div>
      )}
      {message && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-space-3">
        <button type="button" onClick={() => void run()} disabled={!preview || pending} className="min-h-11 rounded-md border-none bg-teal px-space-4 text-label font-semibold text-ink disabled:opacity-50">
          Import
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="min-h-11 px-space-3 text-label underline"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
