"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInvite } from "@/lib/invites/actions";
import { creatorPath } from "@/lib/routes";

/** The one button on the invitation page. Accepting turns the signed-in account into a creator. */
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function accept() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await acceptInvite(token);
      if (result.ok) {
        router.replace(creatorPath());
        return;
      }
      setMessage(result.message);
    } catch {
      setMessage("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-space-3">
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="h-[52px] self-start rounded-md bg-coral px-7 text-body font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "One moment…" : "Accept"}
      </button>
      {message && (
        <p role="alert" className="m-0 text-label text-coral-text">
          {message}
        </p>
      )}
    </div>
  );
}
