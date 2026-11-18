"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { deleteSegment, saveSegment, type SavedSegment } from "@/lib/review/actions";
import { SEGMENT_TEXT_MAX, formatTime, parseTime } from "@/lib/review/segments";
import { stripTashkeel } from "@/lib/text/normalize";
import { SaveStatus, type SaveState } from "./SaveStatus";

export type RowData = {
  /** A client-side key, stable for the life of the row (the database id once there is one). */
  key: string;
  id?: string;
  revision?: number;
  start: number;
  end: number;
  script: string;
  transliteration: string;
  english: string;
};

export type RowSaved = { key: string; id: string; revision: number; start: number; end: number; saved: SavedSegment };

type Props = {
  videoId: string;
  data: RowData;
  index: number;
  readOnly: boolean;
  /** The language's code and writing direction, from the language data. */
  lang: string;
  dir: "rtl" | "ltr";
  scriptLabel: string;
  /** Words of this row that the glossary already has (by matching key); shown highlighted in the word line. */
  isLinked: (word: string) => boolean;
  onSaved: (saved: RowSaved) => void;
  onRemoved: (key: string) => void;
  onReload: () => void;
  onWord: (word: string) => void;
};

const input = "h-[44px] w-full rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";
const timeInput = "h-[44px] w-24 rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";
const DEBOUNCE_MS = 700;

type Local = { start: string; end: string; script: string; transliteration: string; english: string };

/** Why a row cannot be saved yet, or null when it can. Kept short: the owner is mid-edit. */
function localProblem(v: Local): string | null {
  const start = parseTime(v.start);
  const end = parseTime(v.end);
  if (start === null) return "Add a start time, like 0:04.";
  if (end === null) return "Add an end time, like 0:11.";
  if (end <= start) return "The start needs to come before the end.";
  if (v.script.trim() === "") return "Add the Arabic text to save this segment.";
  if ([v.script, v.transliteration, v.english].some((t) => t.length > SEGMENT_TEXT_MAX)) return `Keep each line to ${SEGMENT_TEXT_MAX.toLocaleString("en")} characters or fewer.`;
  return null;
}

/** One transcript segment: times, the script, transliteration and English. Saves itself shortly after the last change, when it is valid. */
function SegmentRowImpl({ videoId, data, index, readOnly, lang, dir, scriptLabel, isLinked, onSaved, onRemoved, onReload, onWord }: Props) {
  const uid = useId();
  const [local, setLocal] = useState<Local>({
    start: formatTime(data.start),
    end: formatTime(data.end),
    script: data.script,
    transliteration: data.transliteration,
    english: data.english,
  });
  const [state, setState] = useState<SaveState>(data.id ? "saved" : "unsaved");
  const [message, setMessage] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dirty, setDirty] = useState(!data.id);

  const identity = useRef({ id: data.id, revision: data.revision });
  const latest = useRef(local);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef(false);
  const again = useRef(false);
  const conflicted = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    const values = latest.current;
    const invalid = localProblem(values);
    if (invalid) {
      setProblem(invalid);
      setState("unsaved");
      return;
    }
    setProblem(null);
    inFlight.current = true;
    setState("saving");
    const start = parseTime(values.start)!;
    const end = parseTime(values.end)!;
    try {
      const result = await saveSegment({
        videoId,
        segmentId: identity.current.id,
        revision: identity.current.revision,
        start,
        end,
        script: values.script,
        transliteration: values.transliteration,
        english: values.english,
      });
      if (!mounted.current) return;
      if (result.ok) {
        identity.current = { id: result.segment.id, revision: result.segment.revision };
        const stillDirty = again.current;
        setDirty(stillDirty);
        conflicted.current = false;
        setConflict(false);
        setMessage(undefined);
        setState(stillDirty ? "unsaved" : "saved");
        onSaved({ key: data.key, id: result.segment.id, revision: result.segment.revision, start, end, saved: result });
      } else if (result.kind === "conflict") {
        setConflict(true);
        conflicted.current = true;
        setMessage(result.message);
        setState("error");
      } else {
        setMessage(result.problems?.[0]?.message ?? result.message);
        setState("error");
      }
    } catch {
      if (mounted.current) {
        setMessage("Something went wrong. Please try again.");
        setState("error");
      }
    } finally {
      inFlight.current = false;
      if (again.current && mounted.current && !conflicted.current) {
        again.current = false;
        void flush();
      }
    }
  }, [videoId, data.key, onSaved]);

  function change(field: keyof Local, value: string) {
    const next = { ...latest.current, [field]: value };
    latest.current = next;
    setLocal(next);
    setDirty(true);
    setState("unsaved");
    setMessage(undefined);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }

  async function remove() {
    if (!identity.current.id) {
      onRemoved(data.key);
      return;
    }
    setState("saving");
    const result = await deleteSegment({ videoId, segmentId: identity.current.id, revision: identity.current.revision ?? 0 });
    if (!mounted.current) return;
    if (result.ok) onRemoved(data.key);
    else {
      setConflict(result.kind === "conflict");
      setMessage(result.message);
      setState("error");
      setConfirming(false);
    }
  }

  const noTashkeel = local.script.trim() !== "" && stripTashkeel(local.script) === local.script;
  const words = local.script.split(/\s+/).filter(Boolean);
  const showWords = !readOnly && !dirty && state === "saved" && words.length > 0;

  return (
    <div className="flex flex-col gap-space-2 rounded-lg border border-hairline bg-paper p-space-4">
      <div className="flex flex-wrap items-center justify-between gap-space-2">
        <span className="text-caption font-semibold text-ink">
          Segment {index + 1} <span className="font-normal text-slate">· {local.start || "?"} – {local.end || "?"}</span>
        </span>
        <span className="flex items-center gap-space-3">
          <SaveStatus state={state} />
          {!readOnly &&
            (confirming ? (
              <span className="flex items-center gap-space-2">
                <button type="button" onClick={() => void remove()} className="min-h-11 rounded-md border border-coral-text px-space-3 text-label text-coral-text">
                  Yes, remove it
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-space-3 text-label underline">
                  Keep it
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} aria-label={`Remove segment ${index + 1}`} className="min-h-11 px-space-3 text-label underline">
                Remove
              </button>
            ))}
        </span>
      </div>
      <div className="flex flex-wrap gap-space-3">
        <label className="flex flex-col gap-1 text-caption text-slate">
          Start
          <input aria-label={`Start of segment ${index + 1}`} value={local.start} disabled={readOnly} onChange={(e) => change("start", e.target.value)} inputMode="decimal" className={timeInput} />
        </label>
        <label className="flex flex-col gap-1 text-caption text-slate">
          End
          <input aria-label={`End of segment ${index + 1}`} value={local.end} disabled={readOnly} onChange={(e) => change("end", e.target.value)} inputMode="decimal" className={timeInput} />
        </label>
      </div>
      <input
        lang={lang}
        dir={dir}
        aria-label={scriptLabel}
        aria-describedby={noTashkeel ? `${uid}-tashkeel` : undefined}
        value={local.script}
        disabled={readOnly}
        onChange={(e) => change("script", e.target.value)}
        className="h-[54px] w-full rounded-sm border border-slate bg-paper px-space-3 font-naskh text-[23px] text-ink"
      />
      {noTashkeel && !readOnly && (
        <p id={`${uid}-tashkeel`} className="m-0 text-caption text-slate">
          Add the vowel marks if you can. Learners rely on them.
        </p>
      )}
      <div className="grid gap-space-3 md:grid-cols-2">
        <input aria-label="Transliteration" value={local.transliteration} disabled={readOnly} onChange={(e) => change("transliteration", e.target.value)} className={input} />
        <input aria-label="English" value={local.english} disabled={readOnly} onChange={(e) => change("english", e.target.value)} className={input} />
      </div>
      {showWords && (
        <div lang={lang} dir={dir} aria-label={`Words in segment ${index + 1}`} className="flex flex-wrap gap-1.5 pt-1">
          {words.map((word, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              onClick={() => onWord(word)}
              aria-label={`${isLinked(word) ? "Glossary word" : "Add to glossary"}: ${word}`}
              className={`min-h-11 rounded-sm px-space-3 font-naskh text-[20px] ${isLinked(word) ? "bg-teal/20 text-ink underline decoration-teal" : "border border-hairline text-ink"}`}
            >
              {word}
            </button>
          ))}
        </div>
      )}
      {problem && state !== "saved" && <p className="m-0 text-caption text-slate">{problem}</p>}
      {message && (
        <p role="alert" className="m-0 flex flex-wrap items-center gap-space-3 text-label text-coral-text">
          {message}
          {conflict && (
            <button type="button" onClick={onReload} className="min-h-11 rounded-md border border-ink px-space-3 text-label text-ink">
              Reload this segment
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export const SegmentRow = memo(SegmentRowImpl);
