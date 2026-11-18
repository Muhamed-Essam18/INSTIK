"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { decide } from "@/lib/review/actions";
import { ownerPath } from "@/lib/routes";

type Decision = "approve" | "changes" | "reject";

const secondary = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate bg-paper px-space-4 text-label font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Reject, Request changes and Approve and publish (docs/design/OwnerReview.dc.html). Approve stays disabled, with the reason beside it,
 * until the checklist is ticked and a segment exists; a note is required for the other two. One decision at a time: no double submit.
 */
export function DecisionBar({ videoId, creatorName, canApprove }: { videoId: string; creatorName: string; canApprove: boolean }) {
  const uid = useId();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Decision | null>(null);
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState<string>();

  async function run(decision: Decision) {
    if (pending || outcome) return;
    setError(undefined);
    if (decision !== "approve" && note.trim() === "") {
      setError("Write a short note to the creator first. Be specific and kind.");
      return;
    }
    setPending(decision);
    try {
      const result = await decide({ videoId, decision, note });
      if (result.ok) setOutcome(result.message);
      else setError(result.message);
    } catch {
      setError("Something went wrong. Nothing was changed. Please try again.");
    }
    setPending(null);
  }

  if (outcome) {
    return (
      <div className="flex flex-col gap-space-3 rounded-lg border border-hairline bg-paper p-space-6">
        <p role="status" className="m-0 text-body-lg text-ink">
          {outcome}
        </p>
        <Link href={ownerPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
          Back to the review queue
        </Link>
      </div>
    );
  }

  const busy = pending !== null;
  return (
    <div className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6">
      <label htmlFor={`${uid}-note`} className="flex max-w-[640px] flex-col gap-1.5 text-label text-ink">
        Note to the creator
        <textarea
          id={`${uid}-note`}
          rows={2}
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Required when you request changes or reject. Be specific and kind."
          className="rounded-sm border border-slate bg-paper px-space-3 py-space-3 text-body font-normal text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-space-3">
        <button type="button" onClick={() => void run("reject")} disabled={busy} className={secondary}>
          Reject
        </button>
        <button type="button" onClick={() => void run("changes")} disabled={busy} className={secondary}>
          Request changes
        </button>
        <button
          type="button"
          onClick={() => void run("approve")}
          disabled={!canApprove || busy}
          aria-describedby={`${uid}-why`}
          className="inline-flex min-h-11 items-center justify-center rounded-md border-none bg-teal px-space-4 text-label font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve and publish
        </button>
      </div>
      <span id={`${uid}-why`} className="text-caption text-slate">
        Approve unlocks when every checklist item is ticked and there is at least one transcript segment. Approving publishes the video to learners and tells {creatorName}.
      </span>
      {error && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {error}
        </p>
      )}
    </div>
  );
}
