"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDraft } from "@/lib/creator/actions";
import { creatorVideosPath } from "@/lib/routes";

/** Deleting a draft asks once, in the page (no browser pop-up), and then takes the creator back to My videos. */
export function DeleteDraft({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function confirm() {
    setPending(true);
    const result = await deleteDraft({ videoId });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.push(creatorVideosPath());
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="min-h-11 rounded-md border border-slate bg-paper px-space-4 text-label font-semibold text-ink">
        Delete draft
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirm deleting this draft" className="flex flex-col gap-space-3 rounded-lg border border-slate bg-paper p-space-4">
      <p className="m-0 text-body text-ink">Delete this draft? Your uploaded file will be removed and you can&apos;t get it back.</p>
      <div className="flex flex-wrap gap-space-3">
        <button type="button" onClick={confirm} disabled={pending} className="min-h-11 rounded-md bg-ink px-space-4 text-label font-semibold text-cream disabled:opacity-60">
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={pending} className="min-h-11 rounded-md border border-ink bg-paper px-space-4 text-label font-semibold text-ink">
          Keep it
        </button>
      </div>
      {message && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {message}
        </p>
      )}
    </div>
  );
}
