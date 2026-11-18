"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlossaryRow } from "@/lib/review/glossary";
import { coreWord, glossaryKey } from "@/lib/review/glossary";
import type { SegmentView } from "@/lib/review/service";
import { SegmentRow, type RowData, type RowSaved } from "./SegmentRow";
import { VttImport } from "./VttImport";
import { WordPanel } from "./WordPanel";

const fromSegments = (segments: readonly SegmentView[]): RowData[] =>
  segments.map((s) => ({ key: s.id, id: s.id, revision: s.revision, start: s.start, end: s.end, script: s.script, transliteration: s.transliteration, english: s.english }));

/** The transcript: one autosaving row per segment, Add segment, Import .vtt and the word panel for glossary entries. */
export function TranscriptEditor({
  videoId,
  segments,
  entries: initialEntries,
  lang,
  dir,
  scriptLabel,
  readOnly,
  onCount,
}: {
  videoId: string;
  segments: readonly SegmentView[];
  entries: Record<string, GlossaryRow>;
  lang: string;
  dir: "rtl" | "ltr";
  scriptLabel: string;
  readOnly: boolean;
  /** Told how many segments are saved, so the decision bar knows whether a transcript exists. */
  onCount: (count: number) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<RowData[]>(() => fromSegments(segments));
  const [entries, setEntries] = useState<Record<string, GlossaryRow>>(initialEntries);
  const [word, setWord] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>();
  const counter = useRef(0);

  // Fresh data from the server (after an import or a reload): start from it.
  const seen = useRef(segments);
  useEffect(() => {
    if (seen.current === segments) return;
    seen.current = segments;
    setRows(fromSegments(segments));
    setEntries((current) => ({ ...current, ...initialEntries }));
  }, [segments, initialEntries]);

  const saved = rows.filter((r) => r.id).length;
  useEffect(() => onCount(saved), [saved, onCount]);

  const linkedKeys = useMemo(() => new Set(Object.values(entries).map((e) => glossaryKey(e.word))), [entries]);
  const isLinked = useCallback((w: string) => linkedKeys.has(glossaryKey(coreWord(w))), [linkedKeys]);
  const byKey = useMemo(() => new Map(Object.values(entries).map((e) => [glossaryKey(e.word), e])), [entries]);

  const onSaved = useCallback((s: RowSaved) => {
    setEntries((current) => ({ ...current, ...s.saved.entries }));
    setRows((current) =>
      current
        .map((r) => (r.key === s.key ? { ...r, id: s.id, revision: s.revision, start: s.start, end: s.end } : r))
        // Segments stay in time order, by their saved times.
        .sort((a, b) => a.start - b.start || a.end - b.end),
    );
  }, []);
  const onRemoved = useCallback((key: string) => setRows((current) => current.filter((r) => r.key !== key)), []);
  const onReload = useCallback(() => router.refresh(), [router]);
  const onWord = useCallback((w: string) => {
    setWord(coreWord(w));
    setNotice(undefined);
  }, []);

  function add() {
    counter.current += 1;
    const start = rows.reduce((latest, r) => Math.max(latest, r.end), 0);
    setRows((current) => [...current, { key: `new-${counter.current}`, start, end: start + 3, script: "", transliteration: "", english: "" }]);
  }

  const entry = word ? byKey.get(glossaryKey(word)) : undefined;

  return (
    <section aria-labelledby={`transcript-${videoId}`} className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6">
      <div className="flex flex-wrap items-center justify-between gap-space-3">
        <h2 id={`transcript-${videoId}`} className="m-0 font-display text-heading text-ink">
          Transcript
        </h2>
        {!readOnly && (
          <div className="flex flex-wrap gap-space-3">
            <VttImport videoId={videoId} onImported={() => router.refresh()} />
            <button type="button" onClick={add} className="min-h-11 rounded-md border border-slate bg-paper px-space-4 text-label text-ink">
              Add segment
            </button>
          </div>
        )}
      </div>
      {rows.length === 0 && <p className="m-0 text-body text-slate">{readOnly ? "There is no transcript yet." : "No segments yet. Add one, or import a .vtt file."}</p>}
      <div className="flex flex-col gap-space-3">
        {rows.map((row, index) => (
          <SegmentRow
            key={row.key}
            videoId={videoId}
            data={row}
            index={index}
            readOnly={readOnly}
            lang={lang}
            dir={dir}
            scriptLabel={scriptLabel}
            isLinked={isLinked}
            onSaved={onSaved}
            onRemoved={onRemoved}
            onReload={onReload}
            onWord={onWord}
          />
        ))}
      </div>
      {word && !readOnly && (
        <WordPanel
          key={`${word}-${entry?.id ?? "new"}`}
          videoId={videoId}
          word={word}
          entry={entry}
          lang={lang}
          dir={dir}
          notice={notice}
          onEntry={(e, said) => {
            setEntries((current) => ({ ...current, [e.entryKey]: e }));
            setNotice(said);
          }}
          onClose={() => setWord(null)}
        />
      )}
      {!readOnly && <p className="m-0 text-caption text-slate">Tap a word in a saved segment to link it to the glossary.</p>}
    </section>
  );
}
