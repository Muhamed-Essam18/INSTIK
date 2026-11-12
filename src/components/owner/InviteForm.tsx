"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { createInvite } from "@/lib/invites/actions";

/** The owner's form: a creator's name and email. The invitation email does the rest. */
export function InviteForm() {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();
  const errorId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<{ field?: "name" | "email"; message: string }>();
  const [sent, setSent] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSent(undefined);
    setPending(true);
    try {
      const result = await createInvite({ name, email });
      if (result.ok) {
        setSent(email.trim());
        setName("");
        setEmail("");
        router.refresh();
      } else {
        setError({ field: result.field, message: result.message });
      }
    } catch {
      setError({ message: "Something went wrong. Please try again." });
    }
    setPending(false);
  }

  const field = "h-[52px] rounded-sm border border-slate bg-paper px-space-3 text-body font-normal text-ink";
  return (
    <form onSubmit={submit} noValidate className="flex max-w-[560px] flex-col gap-space-4">
      <label htmlFor={nameId} className="flex flex-col gap-1.5 text-label text-ink">
        Name
        <input
          id={nameId}
          name="name"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error?.field === "name" ? true : undefined}
          aria-describedby={error?.field === "name" ? errorId : undefined}
          className={field}
        />
      </label>
      <label htmlFor={emailId} className="flex flex-col gap-1.5 text-label text-ink">
        Email
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error?.field === "email" ? true : undefined}
          aria-describedby={error?.field === "email" ? errorId : undefined}
          className={field}
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="m-0 text-label text-coral-text">
          {error.message}
        </p>
      )}
      {sent && (
        <p role="status" className="m-0 text-label text-teal-text">
          Invitation sent to {sent}. The link works once and lasts 7 days.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-[52px] self-start rounded-md bg-coral px-7 text-body font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
