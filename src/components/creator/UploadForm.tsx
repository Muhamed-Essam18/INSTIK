"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { createUpload, saveDraft, submitVideo } from "@/lib/creator/actions";
import { DESCRIPTION_MAX, TITLE_MAX, type ProblemField } from "@/lib/creator/rules";
import { stages, topics } from "@/lib/content/taxonomy";
import { creatorHostPath, creatorVideoPath } from "@/lib/routes";
import { Checklist } from "./Checklist";
import { Field, describedBy } from "./Field";
import { UploadProgress, type StartResult } from "./UploadProgress";

// The upload page's form (docs/design/CreatorUpload.dc.html), also used to continue a draft and to edit a video in Changes requested.
// The file goes straight to the video host; the details are typed meanwhile; Save draft and Submit for review go through server actions.

export type FormVideo = {
  id: string;
  title: string;
  description: string | null;
  proposedStage: string | null;
  topic: string | null;
};

type FileStep = "uploader" | "in-flight" | "none";

type Props = {
  video?: FormVideo;
  /** "uploader": a drop zone (a new video or a draft). "in-flight": the file is already uploading or processing. "none": details only (Changes requested). */
  fileStep: FileStep;
  /** The creator's language, shown but not chosen (their host page has one). */
  languageLabel: string;
  hostComplete: boolean;
  uploadsEnabled: boolean;
  /** Shown when the video host reports the first file as already on its way. */
  fileNote?: string;
};

const control = "h-[52px] rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";

export function UploadForm({ video, fileStep, languageLabel, hostComplete, uploadsEnabled, fileNote }: Props) {
  const router = useRouter();
  const ids = { title: useId(), stage: useId(), topic: useId(), language: useId(), description: useId() };
  const [videoId, setVideoId] = useState<string | undefined>(video?.id);
  const [title, setTitle] = useState(video?.title ?? "");
  const [stage, setStage] = useState(video?.proposedStage ?? "");
  const [topic, setTopic] = useState(video?.topic ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false]);
  const [phase, setPhase] = useState<"idle" | "starting" | "uploading" | "uploaded" | "error">("idle");
  const [errors, setErrors] = useState<Partial<Record<ProblemField, string>>>({});
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  const details = () => ({ title, description, proposedStage: stage || null, topic: topic || null });
  const uploading = phase === "starting" || phase === "uploading";

  async function start(): Promise<StartResult> {
    const result = await createUpload({ kind: "first", ...(videoId ? { videoId } : { details: details() }) });
    if (!result.ok) return { ok: false, message: result.message };
    setVideoId(result.videoId);
    return { ok: true, uploadUrl: result.uploadUrl };
  }

  async function save() {
    setMessage(undefined);
    setErrors({});
    setPending(true);
    const result = await saveDraft({ ...(videoId ? { videoId } : {}), details: details() });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setVideoId(result.videoId);
    // Leaving would stop an upload that is still going, so stay and say it is saved.
    if (uploading) setMessage("Draft saved. Your upload carries on.");
    else router.push(creatorVideoPath(result.videoId));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setErrors({});
    if (uploading) {
      setMessage("Your video is still uploading. You can submit as soon as it's done.");
      return;
    }
    // A new video with no file yet: say so here, without asking the server.
    if (!videoId && fileStep === "uploader") {
      setErrors({ upload: "Add your video file first." });
      return;
    }
    if (!videoId) return;
    setPending(true);
    const result = await submitVideo({ videoId, details: details(), checklist: checked });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      if (result.fields) setErrors(result.fields);
      return;
    }
    router.push(creatorVideoPath(result.videoId));
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[720px] flex-col gap-space-6">
      {fileStep === "uploader" &&
        (uploadsEnabled ? (
          <div className="flex flex-col gap-space-2">
            <UploadProgress start={start} onPhase={setPhase} />
            {errors.upload && (
              <p role="alert" className="m-0 text-label text-coral-text">
                {errors.upload}
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 rounded-lg border border-hairline bg-paper p-space-4 text-body text-ink">
            Uploads aren&apos;t set up yet, so you can&apos;t add a video file today. You can still write your details and save a draft.
          </p>
        ))}
      {fileStep === "in-flight" && (
        <p className="m-0 rounded-lg border border-hairline bg-paper p-space-4 text-body text-ink">{fileNote ?? "Your video file is on its way."}</p>
      )}

      <Field id={ids.title} label="Title" error={errors.title}>
        <input
          id={ids.title}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(ids.title, false, Boolean(errors.title))}
          className={control}
        />
      </Field>

      <div className="grid gap-space-6 md:grid-cols-2">
        <Field
          id={ids.stage}
          label="Stage"
          hint="Who is this for? Slow and simple is Hear it. Instik confirms the stage when reviewing."
          error={errors.proposedStage}
        >
          <select
            id={ids.stage}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            aria-invalid={errors.proposedStage ? true : undefined}
            aria-describedby={describedBy(ids.stage, true, Boolean(errors.proposedStage))}
            className={control}
          >
            <option value="">Choose a stage</option>
            {stages.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={ids.topic} label="Topic" error={errors.topic}>
          <select
            id={ids.topic}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-invalid={errors.topic ? true : undefined}
            aria-describedby={describedBy(ids.topic, false, Boolean(errors.topic))}
            className={control}
          >
            <option value="">Choose a topic</option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id={ids.language} label="Language" error={errors.languageCode}>
        <input
          id={ids.language}
          value={languageLabel}
          readOnly
          aria-describedby={describedBy(ids.language, false, Boolean(errors.languageCode))}
          className={`${control} bg-cream`}
        />
      </Field>

      <Field id={ids.description} label="Short description" hint="Shown to learners under the video." error={errors.description}>
        <textarea
          id={ids.description}
          value={description}
          maxLength={DESCRIPTION_MAX}
          rows={4}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy(ids.description, true, Boolean(errors.description))}
          className="rounded-sm border border-slate bg-paper px-space-3 py-space-3 text-body font-normal text-ink"
        />
      </Field>

      <Checklist checked={checked} onChange={setChecked} error={errors.checklist} />

      <p className="m-0 text-body text-slate">
        You don&apos;t need a transcript. The Instik team writes it after upload, then reviews the video. You&apos;ll see the status in My videos.
      </p>

      {!hostComplete && (
        <p className="m-0 text-body text-ink" role={errors.host ? "alert" : undefined}>
          {errors.host ?? "Before you can submit, finish your host page: a photo, your name in both scripts and a short story."}{" "}
          <Link href={creatorHostPath()}>Go to My host page</Link>
        </p>
      )}
      {hostComplete && errors.host && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {errors.host} <Link href={creatorHostPath()}>Go to My host page</Link>
        </p>
      )}

      {message && (
        <p role="status" className="m-0 text-body text-ink">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-space-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-12 rounded-md border border-ink bg-paper px-space-6 text-body font-semibold text-ink disabled:opacity-60"
        >
          Save draft
        </button>
        <button type="submit" disabled={pending} className="min-h-12 rounded-md bg-coral px-space-6 text-body font-semibold text-ink disabled:opacity-60">
          {pending ? "Working…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
