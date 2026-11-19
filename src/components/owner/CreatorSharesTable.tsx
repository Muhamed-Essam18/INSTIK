import { MarkPaidButton } from "@/components/owner/MarkPaidButton";
import { formatBasisPoints, formatDayShort, formatMoney } from "@/lib/earnings/format";
import { NO_VIEWS } from "@/lib/earnings/messages";
import type { StatementView } from "@/lib/earnings/service";
import { warsawDayOf } from "@/lib/time/warsaw";

const th = "px-space-4 py-space-3 font-semibold";
const td = "px-space-4 py-space-3";

/**
 * Each creator's counted views, share and earnings for the month (docs/design/OwnerEarnings.dc.html). Names only: no learner is ever shown.
 * For a closed month it also shows who has been paid and gives each unpaid creator a Mark as paid button.
 */
export function CreatorSharesTable({ statement }: { statement: StatementView }) {
  const { lines, final } = statement;
  return (
    <section aria-labelledby="shares-heading" className="flex flex-col gap-space-3">
      <h2 id="shares-heading" className="m-0 font-display text-heading text-ink">
        Creator shares
      </h2>
      {lines.length === 0 ? (
        <div className="rounded-lg border border-hairline bg-paper p-space-6">
          <p className="m-0 text-body-lg text-ink">{NO_VIEWS}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-hairline bg-paper">
          <table className="w-full min-w-[620px] border-collapse text-left text-body">
            <caption className="sr-only">Creator shares for the month</caption>
            <thead>
              <tr className="border-b border-hairline text-label text-slate">
                <th scope="col" className={th}>
                  Creator
                </th>
                <th scope="col" className={th}>
                  Counted views
                </th>
                <th scope="col" className={th}>
                  Share
                </th>
                <th scope="col" className={th}>
                  Earnings
                </th>
                <th scope="col" className={th}>
                  Payout
                </th>
                {final && (
                  <th scope="col" className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const nothingToPay = final && (line.earningsCents ?? 0) <= 0;
                return (
                  <tr key={line.creatorId ?? line.name} className="border-b border-hairline align-middle last:border-b-0">
                    <th scope="row" className={`${td} font-semibold`}>
                      {line.name}
                    </th>
                    <td className={td}>{line.views.toLocaleString("en-GB")}</td>
                    <td className={td}>{formatBasisPoints(line.shareBasisPoints)}</td>
                    <td className={td}>{line.earningsCents === null ? "—" : formatMoney(line.earningsCents, statement.currency)}</td>
                    <td className={td}>
                      {line.payout === null || nothingToPay ? (
                        <span className="text-slate">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-pill px-space-3 py-1 text-label font-semibold ${line.payout === "paid" ? "bg-teal text-ink" : "bg-coral-tint text-ink"}`}
                        >
                          {line.payout === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      )}
                    </td>
                    {final && (
                      <td className={td}>
                        {line.payout === "paid" ? (
                          <span className="text-slate">{line.paidAt ? `Paid ${formatDayShort(warsawDayOf(line.paidAt))}` : "Paid"}</span>
                        ) : line.creatorId && !nothingToPay ? (
                          <MarkPaidButton month={statement.month} creatorId={line.creatorId} name={line.name} />
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
