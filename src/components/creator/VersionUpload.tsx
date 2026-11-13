"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUpload, submitVideo } from "@/lib/creator/actions";
import type { ProblemField } from "@/lib/creator/rules";
import { Checklist } from "./Checklist";
import { UploadProgress, type StartResult } from "./UploadProgress";

// On the status page of a video in Changes requested: upload a new version (held apart from the current file), then confirm the
// checklist again and submit. The video stays in Changes requested until then. Submitting without a new version resubmits the
// details as they are.

type Props = {
  videoId: string;
  details: { title: string; description: string | null; proposedStage: string | null; topic: string | null };
  /** "New version processing", "New version ready to submit" or "New version didn't finish"; null when none is on the way. */
  pendingLabel: string | null;
  /** The plain reason the last new version failed, if it did. */
  failure: string | null;
  uploadsEnabled: boolean;
};

export function VersionUpload({ videoId, details, pendingLabel, failure, uploadsEnabled }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false]);
  const [errors, setErrors] = useState<Partial<Record<ProblemField, string>>>({});
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function start(): Promise<StartResult> {
    const result = await createUpload({ videoId, kind: "newVersion" });
    return result.ok ? { ok: true, uploadUrl: result.uploadUrl } : { ok: false, message: result.message };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setErrors({});
    if (uploading) {
      setMessage("Your new version is still uploading. You can submit as soon as it's done.");
      return;
    }
    setPending(true);
    const result = await submitVideo({ videoId, details, checklist: checked });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      if (result.fields) setErrors(result.fields);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-space-4">
      <h2 className="m-0 font-display text-[22px] leading-7 font-extrabold text-ink">Upload a new version</h2>
      {pendingLabel && (
        <p role="status" className="m-0 text-body font-semibold text-ink">
          {pendingLabel}
        </p>
      )}
      {failure && (
        <p role="alert" className="m-0 text-body text-coral-text">
          {failure}
        </p>
      )}
      {uploadsEnabled ? (
        <UploadProgress start={start} onPhase={(p) => setUploading(p === "starting" || p === "uploading")} onUploaded={() => router.refresh()} heading="Drop your new version here" />
      ) : (
        <p className="m-0 text-body text-ink">Uploads aren&apos;t set up yet, so a new file can&apos;t be added today.</p>
      )}
      <Checklist checked={checked} onChange={setChecked} error={errors.checklist} />
      {errors.upload && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {errors.upload}
        </p>
      )}
      {errors.host && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {errors.host}
        </p>
      )}
      {message && (
        <p role="status" className="m-0 text-body text-ink">
          {message}
        </p>
      )}
      <button type="submit" disabled={pending} className="min-h-12 self-start rounded-md bg-coral px-space-6 text-body font-semibold text-ink disabled:opacity-60">
        {pending ? "Working…" : "Submit for review"}
      </button>
    </form>
  );
}
