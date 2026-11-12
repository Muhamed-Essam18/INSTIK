"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { revokeInvite } from "@/lib/invites/actions";

/** Revokes one pending invitation; the link stops working straight away. */
export function RevokeButton({ inviteId, name }: { inviteId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function revoke() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await revokeInvite(inviteId);
      if (!result.ok) setMessage(result.message);
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={revoke}
        disabled={pending}
        aria-label={`Revoke the invitation for ${name}`}
        className="inline-flex min-h-11 items-center self-start text-label text-ink underline disabled:opacity-60"
      >
        Revoke
      </button>
      {message && (
        <span role="alert" className="text-caption text-coral-text">
          {message}
        </span>
      )}
    </span>
  );
}
