import { RemoveGrantButton } from "@/components/owner/RemoveGrantButton";
import { formatDay } from "@/lib/earnings/format";
import { reasonLabel } from "@/lib/grants/messages";
import type { GrantsView } from "@/lib/grants/service";
import { warsawDayOf } from "@/lib/time/warsaw";

/**
 * The accounts that have Full access from an owner now, then the latest changes: who did what, when, why and the note. The list ends at the latest
 * 100 changes, with a plain note when there are more. Records are append-only: ending a grant is a new record.
 */
export function GrantHistory({ view }: { view: GrantsView }) {
  const { active, events, truncated } = view;
  return (
    <div className="flex flex-col gap-space-6">
      <section aria-labelledby="active-heading" className="flex flex-col gap-space-3">
        <h2 id="active-heading" className="m-0 font-display text-heading text-ink">
          Full access from you
        </h2>
        {active.length === 0 ? (
          <div className="rounded-lg border border-hairline bg-paper p-space-6">
            <p className="m-0 text-body-lg text-ink">Nobody has Full access from you right now.</p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-space-2 rounded-lg border border-hairline bg-paper p-space-4">
            {active.map((g) => (
              <li key={g.userId} className="flex flex-wrap items-center justify-between gap-space-3 border-b border-hairline py-space-2 last:border-b-0">
                <span className="text-body text-ink">
                  <span className="font-semibold">{g.email}</span>
                  <span className="block text-caption text-slate">
                    {g.name ? `${g.name} · ` : ""}
                    {g.reason ? `${reasonLabel[g.reason]} · ` : ""}since {formatDay(warsawDayOf(g.since), true)}
                    {g.byName ? ` · by ${g.byName}` : ""}
                    {g.note ? ` · ${g.note}` : ""}
                  </span>
                </span>
                <RemoveGrantButton email={g.email} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-space-3">
        <h2 id="history-heading" className="m-0 font-display text-heading text-ink">
          Recent changes
        </h2>
        {events.length === 0 ? (
          <p className="m-0 text-body text-slate">No changes yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-space-1 rounded-lg border border-hairline bg-paper p-space-4">
            {events.map((e) => (
              <li key={e.id} className="border-b border-hairline py-space-2 text-body text-ink last:border-b-0">
                <span className="font-semibold">
                  {e.kind === "GRANTED" ? "Given" : "Removed"}: {e.email}
                </span>
                <span className="block text-caption text-slate">
                  {reasonLabel[e.reason]} · {formatDay(warsawDayOf(e.at), true)} · {e.byName ?? "an owner"}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {truncated && <p className="m-0 text-caption text-slate">Showing the latest 100 changes.</p>}
      </section>
    </div>
  );
}
