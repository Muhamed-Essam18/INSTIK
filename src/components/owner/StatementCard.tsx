import { formatMoney, formatMonth, formatMonthName } from "@/lib/earnings/format";
import { LEFTOVER_CENTS_HELP, NOT_ENTERED, netZeroExplanation } from "@/lib/earnings/messages";
import type { StatementView } from "@/lib/earnings/service";

const row = "flex justify-between gap-space-4 border-b border-hairline py-space-3";

/**
 * One month's statement from gross revenue to net, and the 80/20 split (docs/design/OwnerEarnings.dc.html). While a month is open every
 * figure is an estimate; with no revenue entered it says so and shows no amounts.
 */
export function StatementCard({ statement }: { statement: StatementView }) {
  const money = (cents: number) => formatMoney(cents, statement.currency);
  const { revenue } = statement;
  const monthName = formatMonthName(statement.month);

  return (
    <section aria-labelledby="statement-heading" className="flex flex-col gap-space-3">
      <div className="flex flex-wrap items-center gap-space-3">
        <h2 id="statement-heading" className="m-0 font-display text-heading text-ink">
          {formatMonth(statement.month)}
        </h2>
        <span
          className={`inline-flex items-center rounded-pill px-space-3 py-1 text-label font-semibold ${statement.final ? "bg-teal text-ink" : "bg-sun text-ink"}`}
        >
          {statement.final ? "Final" : "Estimated"}
        </span>
      </div>
      <div className="flex flex-col rounded-lg bg-paper p-space-6 shadow-sm">
        {revenue ? (
          <>
            <dl className="m-0 flex flex-col">
              <div className={row}>
                <dt>Subscription revenue (gross)</dt>
                <dd className="m-0">{money(revenue.grossCents)}</dd>
              </div>
              <div className={row}>
                <dt>VAT collected</dt>
                <dd className="m-0">{money(-revenue.vatCents)}</dd>
              </div>
              <div className={row}>
                <dt>Payment fees</dt>
                <dd className="m-0">{money(-revenue.feesCents)}</dd>
              </div>
              <div className={row}>
                <dt>Refunds</dt>
                <dd className="m-0">{money(-revenue.refundsCents)}</dd>
              </div>
              {statement.adjustments.length > 0 && (
                <div className={row}>
                  <dt>Adjustments</dt>
                  <dd className="m-0">{money(statement.adjustmentsCents)}</dd>
                </div>
              )}
              <div className={`${row} font-bold`}>
                <dt>Net revenue</dt>
                <dd className="m-0">{money(statement.netCents ?? 0)}</dd>
              </div>
            </dl>
            {statement.netFloored && <p className="m-0 mt-space-3 text-body text-ink">{netZeroExplanation(money(0))}</p>}
            <div className="mt-space-4 grid grid-cols-2 gap-space-3">
              <div className="flex flex-col rounded-md bg-coral-tint p-space-4">
                <span className="text-caption font-semibold">Creator pool · 80%</span>
                <span className="font-display text-[28px] leading-8 font-extrabold">{money(statement.poolCents ?? 0)}</span>
              </div>
              <div className="flex flex-col rounded-md bg-cream p-space-4">
                <span className="text-caption font-semibold">Instik · 20%</span>
                <span className="font-display text-[28px] leading-8 font-extrabold">{money(statement.instikCents ?? 0)}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="m-0 text-body-lg text-ink">{NOT_ENTERED}</p>
        )}
        <p className="m-0 mt-space-3 text-caption text-slate">
          {statement.totalViews.toLocaleString("en-GB")} counted views in {monthName}. A view counts after 30 seconds of real watching, once per learner per
          video per day, from paying learners.
        </p>
        <p className="m-0 mt-space-2 text-caption text-slate">{LEFTOVER_CENTS_HELP}</p>
      </div>
    </section>
  );
}
