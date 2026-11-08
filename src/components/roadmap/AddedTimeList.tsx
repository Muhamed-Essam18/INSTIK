"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeManualTime } from "@/lib/hours/actions";
import { hoursStore } from "@/lib/hours/store";

type Entry = { id: string; day: string; minutes: number };

/** A date like "Mon 3 Nov", the same on the server and in the browser. */
export function formatEntryDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** The learner's own added entries, each labelled "Added by you", each removable. */
export function AddedTimeList({ languageCode, entries }: { languageCode: string; entries: Entry[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (entries.length === 0) return null;

  async function remove(id: string) {
    setRemoving(id);
    setFailed(false);
    try {
      const result = await removeManualTime({ id });
      if (result.ok) {
        hoursStore.set(languageCode, result.totalSeconds);
        router.refresh();
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section aria-labelledby="added-heading" className="flex flex-col gap-space-3 rounded-lg bg-paper p-space-6">
      <h2 id="added-heading" className="m-0 font-display text-heading text-ink">
        Time you added
      </h2>
      <ul className="m-0 flex list-none flex-col gap-space-2 p-0">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-space-3">
            <span className="grow text-body text-ink">
              {formatEntryDay(entry.day)} · {entry.minutes} min
            </span>
            <span className="rounded-pill bg-coral-tint px-space-3 py-space-1 text-caption text-ink">Added by you</span>
            <button
              type="button"
              disabled={removing === entry.id}
              onClick={() => remove(entry.id)}
              aria-label={`Remove ${entry.minutes} minutes added on ${formatEntryDay(entry.day)}`}
              className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-space-2 text-label text-ink underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {failed ? (
        <p role="status" className="m-0 text-caption text-slate">
          Couldn&apos;t remove that just now. Please try again.
        </p>
      ) : null}
    </section>
  );
}
