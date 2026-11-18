"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { pauseCreator, resumeCreator } from "@/lib/creators/actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label text-ink disabled:opacity-60";

/** Pause (after a calm confirmation) or Resume one creator. Takes effect on their next request; their live videos and host page stay up. */
export function PauseButton({ creatorId, name, paused }: { creatorId: string; name: string; paused: boolean }) {
  const router = useRouter();
  const noteId = useId();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function run() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = paused ? await resumeCreator({ creatorId }) : await pauseCreator({ creatorId });
      if (!result.ok) setMessage(result.message);
      else setConfirming(false);
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  if (paused) {
    return (
      <span className="flex flex-col gap-1">
        <button type="button" onClick={run} disabled={pending} aria-label={`Resume ${name}`} className={button}>
          Resume
        </button>
        {message && (
          <span role="alert" className="text-caption text-coral-text">
            {message}
          </span>
        )}
      </span>
    );
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} aria-label={`Pause ${name}`} className={button}>
        Pause
      </button>
    );
  }
  return (
    <span className="flex max-w-[260px] flex-col gap-space-2">
      <span id={noteId} className="text-caption text-slate">
        They won&apos;t be able to upload or submit. Their live videos stay up.
      </span>
      <span className="flex flex-wrap gap-space-2">
        <button type="button" onClick={run} disabled={pending} aria-describedby={noteId} aria-label={`Pause ${name}: confirm`} className={button}>
          Pause {name}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-space-3 text-label underline">
          Cancel
        </button>
      </span>
      {message && (
        <span role="alert" className="text-caption text-coral-text">
          {message}
        </span>
      )}
    </span>
  );
}
