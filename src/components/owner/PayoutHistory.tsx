import { UndoPaymentButton } from "@/components/owner/UndoPaymentButton";
import { formatDay, formatMoney } from "@/lib/earnings/format";
import type { PayoutRow } from "@/lib/earnings/service";
import { warsawDayOf } from "@/lib/time/warsaw";

/**
 * Every payment and undo recorded for the month, newest first, at most the latest 100 (the list ends, with a plain note when there are more).
 * Records are append-only: a mistake is undone by a reversing record, never by editing one.
 */
export function PayoutHistory({ payouts, names, truncated }: { payouts: readonly PayoutRow[]; names: Record<string, string>; truncated: boolean }) {
  if (payouts.length === 0) return null;
  const undone = new Set(payouts.flatMap((p) => (p.kind === "REVERSAL" && p.reversesId ? [p.reversesId] : [])));
  return (
    <section aria-labelledby="payouts-heading" className="flex flex-col gap-space-3">
      <h2 id="payouts-heading" className="m-0 font-display text-heading text-ink">
        Payment history
      </h2>
      <ul className="m-0 flex list-none flex-col gap-space-2 rounded-lg border border-hairline bg-paper p-space-4">
        {payouts.map((p) => {
          const who = (p.creatorId && names[p.creatorId]) || "A creator";
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-space-3 border-b border-hairline py-space-2 last:border-b-0">
              <span className="text-body text-ink">
                <span className="font-semibold">
                  {p.kind === "PAID" ? "Paid" : "Undone"}: {who}, {formatMoney(p.amountCents, p.currency)}
                </span>
                <span className="block text-caption text-slate">
                  {formatDay(warsawDayOf(p.at), true)} · {p.reference} · {p.byName ?? "an owner"}
                </span>
              </span>
              {p.kind === "PAID" && p.creatorId && !undone.has(p.id) ? <UndoPaymentButton payoutId={p.id} creatorId={p.creatorId} name={who} /> : null}
            </li>
          );
        })}
      </ul>
      {truncated && <p className="m-0 text-caption text-slate">Showing the latest 100 records.</p>}
    </section>
  );
}
