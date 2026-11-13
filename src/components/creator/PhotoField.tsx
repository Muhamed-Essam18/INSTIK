"use client";

import { useId, useState } from "react";
import { uploadHostPhoto } from "@/lib/creator/actions";
import { PHOTO_MAX_BYTES, PHOTO_SIZE_MESSAGE } from "@/lib/creator/host-rules";

type Props = { photo: string | null; name: string; enabled: boolean };

/** The host photo: a preview, and a file picker that sends the file to the server to be checked and stored. A refused photo leaves the old one. */
export function PhotoField({ photo, name, enabled }: Props) {
  const inputId = useId();
  const [current, setCurrent] = useState(photo);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setMessage(undefined);
    // The same size limit as on the server, so a big file is not sent at all.
    if (file.size > PHOTO_MAX_BYTES) {
      setMessage(PHOTO_SIZE_MESSAGE);
      return;
    }
    setPending(true);
    const body = new FormData();
    body.set("photo", file);
    try {
      const result = await uploadHostPhoto(body);
      if (result.ok) setCurrent(result.photo);
      else setMessage(result.message);
    } catch {
      setMessage("We couldn't save that photo. Your old photo is still there. Please try again.");
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-space-3">
      <span className="text-label text-ink">Photo</span>
      <div className="flex flex-wrap items-center gap-space-4">
        <div className="flex aspect-[4/5] w-32 items-center justify-center overflow-hidden rounded-lg bg-sun">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt={name ? `${name}, host` : "Your photo"} className="size-full object-cover" />
          ) : (
            <span className="px-space-2 text-center text-caption text-ink">No photo yet</span>
          )}
        </div>
        <div className="flex flex-col gap-space-2">
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="peer sr-only"
            disabled={!enabled || pending}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className={`inline-flex min-h-11 items-center rounded-md border border-ink bg-paper px-space-4 text-label font-semibold text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
              enabled && !pending ? "cursor-pointer" : "opacity-60"
            }`}
          >
            {pending ? "Saving…" : current ? "Change photo" : "Add a photo"}
          </label>
          <span className="text-caption text-slate">JPEG, PNG or WebP, up to 2 MB. A real photo of you.</span>
          {!enabled && <span className="text-caption text-slate">Photo upload isn&apos;t set up yet.</span>}
        </div>
      </div>
      {message && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {message}
        </p>
      )}
    </div>
  );
}
