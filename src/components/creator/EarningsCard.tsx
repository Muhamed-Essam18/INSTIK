import type { DashboardData } from "@/lib/earnings/dashboard-data";
import { formatDay, formatDayShort, formatMoney, formatMonthName } from "@/lib/earnings/format";
import { warsawDayOf } from "@/lib/time/warsaw";

/**
 * The creator's earnings: this month's estimate, last month once it is final (paid or waiting for payment) and the next payout day
 * (docs/design/CreatorDashboard.dc.html). With no revenue entered yet it says so instead of showing a zero. Only this creator's own money.
 */
export function EarningsCard({ earnings, month }: { earnings: DashboardData["earnings"]; month: string }) {
  const { estimateCents, currency, lastMonth } = earnings;
  const last = lastMonth.state === "final" ? lastMonth : null;
  return (
    <section aria-labelledby="earnings-heading" className="flex flex-col gap-space-3">
      <h2 id="earnings-heading" className="m-0 font-display text-heading text-ink">
        Earnings
      </h2>
      <div className="flex flex-col gap-space-4 rounded-lg bg-ink p-space-6 text-cream">
        <span className="text-label">Earnings · {formatMonthName(month)} (estimated)</span>
        {estimateCents === null ? (
          <span className="font-display text-[28px] leading-9 font-extrabold">Not available yet</span>
        ) : (
          <span className="font-display text-[44px] leading-[48px] font-extrabold">{formatMoney(estimateCents, currency)}</span>
        )}
        <dl className="m-0 grid grid-cols-2 gap-space-3 text-label">
          <div className="flex flex-col">
            <dt className="text-cream/70">{formatMonthName(lastMonth.month)}{last ? " (final)" : ""}</dt>
            <dd className="m-0 font-semibold">
              {last
                ? `${formatMoney(last.earningsCents, last.currency)} · ${last.paid && last.paidAt ? `paid ${formatDayShort(warsawDayOf(last.paidAt))}` : "payment pending"}`
                : "Not final yet"}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-cream/70">Next payout</dt>
            <dd className="m-0 font-semibold">{formatDay(earnings.nextPayoutDay)}</dd>
          </div>
        </dl>
        <p className="m-0 text-caption text-cream/80">
          Creators share 80% of Instik&apos;s net subscription revenue, split by counted views. A view counts after 30 seconds of real watching, once per
          learner per video per day, from paying learners. The estimate changes until the month closes.
        </p>
      </div>
    </section>
  );
}
