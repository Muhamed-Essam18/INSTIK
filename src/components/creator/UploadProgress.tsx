"use client";

import { createUpload } from "@mux/upchunk";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { checkFile, formatBytes } from "@/lib/creator/file-rules";

// The file step of the upload page (docs/design/CreatorUpload.dc.html): a drop zone, then a labelled progress bar while the file
// goes straight from the browser to the video host. The one-time link comes from `start`, a server action in the parent; this
// component never sees an id, only the link. It refuses a file that cannot work before anything is sent.

export type StartResult = { ok: true; uploadUrl: string } | { ok: false; message: string };

type State =
  | { phase: "idle" }
  | { phase: "starting"; file: File }
  | { phase: "uploading"; file: File; percent: number; offline: boolean }
  | { phase: "uploaded"; file: File }
  | { phase: "error"; message: string; file: File | null };

type Props = {
  /** Asks the server for the one-time upload link. Called again for Retry. */
  start: () => Promise<StartResult>;
  /** The browser has sent the whole file; the video host now processes it. */
  onUploaded?: () => void;
  /** The upload began, failed, or was dropped: the parent can tell the creator they may not submit yet. */
  onPhase?: (phase: State["phase"]) => void;
  disabled?: boolean;
  /** Text for the drop zone's heading when nothing is chosen. */
  heading?: string;
};

const CHUNK_KB = 30720; // 30 MB chunks: a lost connection costs at most one chunk

export function UploadProgress({ start, onUploaded, onPhase, disabled = false, heading = "Drop your video here" }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [over, setOver] = useState(false);
  const inputId = useId();
  const running = useRef<{ abort: () => void } | null>(null);

  const move = useCallback(
    (next: State) => {
      setState(next);
      onPhase?.(next.phase);
    },
    [onPhase],
  );

  // A creator who leaves the page stops the upload; it can be started again from Drafts.
  useEffect(() => () => running.current?.abort(), []);

  const begin = useCallback(
    async (file: File) => {
      move({ phase: "starting", file });
      let link: StartResult;
      try {
        link = await start();
      } catch {
        move({ phase: "error", file, message: "We couldn't start the upload. Please try again." });
        return;
      }
      if (!link.ok) {
        move({ phase: "error", file, message: link.message });
        return;
      }
      move({ phase: "uploading", file, percent: 0, offline: false });
      const upload = createUpload({ endpoint: link.uploadUrl, file, chunkSize: CHUNK_KB });
      running.current = upload;
      upload.on("progress", (event) =>
        setState((s) => (s.phase === "uploading" ? { ...s, percent: Math.min(100, Math.floor(event.detail)), offline: false } : s)),
      );
      upload.on("offline", () => setState((s) => (s.phase === "uploading" ? { ...s, offline: true } : s)));
      upload.on("online", () => setState((s) => (s.phase === "uploading" ? { ...s, offline: false } : s)));
      upload.on("error", () => {
        running.current = null;
        move({ phase: "error", file, message: "The upload stopped before it finished. Your details are safe. Please try again." });
      });
      upload.on("success", () => {
        running.current = null;
        move({ phase: "uploaded", file });
        onUploaded?.();
      });
    },
    [move, onUploaded, start],
  );

  const choose = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      const check = checkFile(file);
      if (!check.ok) {
        move({ phase: "error", file: null, message: check.message });
        return;
      }
      void begin(file);
    },
    [begin, disabled, move],
  );

  const file = state.phase === "idle" || (state.phase === "error" && !state.file) ? null : state.file;
  const percent = state.phase === "uploading" ? state.percent : state.phase === "uploaded" ? 100 : 0;
  const picker = (
    <>
      <input
        id={inputId}
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        className="peer sr-only"
        disabled={disabled}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-ink bg-paper px-space-4 text-label font-semibold text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >
        {file ? "Choose a different file" : "Choose a file"}
      </label>
    </>
  );

  return (
    <div className="flex flex-col gap-space-3">
      {state.phase === "idle" || (state.phase === "error" && !file) ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-space-3 rounded-lg border-2 border-dashed px-space-6 py-space-12 text-center ${
            over ? "border-coral-text bg-coral-tint" : "border-slate bg-paper"
          }`}
        >
          <p className="m-0 font-display text-[22px] leading-7 font-extrabold text-ink">{heading}</p>
          <p className="m-0 max-w-prose text-body text-slate">
            MP4 or MOV, up to 4 GB. Your file goes straight to our video host, so large files are fine.
          </p>
          {picker}
        </div>
      ) : (
        <div className="flex flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-4">
          <div className="flex flex-wrap items-baseline justify-between gap-space-2">
            <p className="m-0 min-w-0 break-words text-body font-semibold text-ink">
              {file!.name} <span className="font-normal text-slate">({formatBytes(file!.size)})</span>
            </p>
            <p className="m-0 text-label text-ink" aria-live="polite">
              {state.phase === "starting" && "Getting ready…"}
              {state.phase === "uploading" && (state.offline ? `Waiting for your connection · ${percent}%` : `Uploading · ${percent}%`)}
              {state.phase === "uploaded" && "Uploaded. Processing now."}
              {state.phase === "error" && "Not uploaded"}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
            className="h-3 w-full overflow-hidden rounded-pill bg-hairline"
          >
            <div className={`h-full rounded-pill ${state.phase === "error" ? "bg-slate" : "bg-teal"}`} style={{ width: `${percent}%` }} />
          </div>
          {state.phase === "error" && (
            <div className="flex flex-wrap items-center gap-space-3">
              <p role="alert" className="m-0 text-label text-coral-text">
                {state.message}
              </p>
              <button
                type="button"
                onClick={() => void begin(file!)}
                className="min-h-11 rounded-md bg-coral px-space-4 text-label font-semibold text-ink"
              >
                Try again
              </button>
            </div>
          )}
          {state.phase !== "uploading" && state.phase !== "starting" && <div>{picker}</div>}
        </div>
      )}
      {state.phase === "error" && !file && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {state.message}
        </p>
      )}
    </div>
  );
}
