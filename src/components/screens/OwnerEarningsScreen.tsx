import { AdjustmentForm } from "@/components/owner/AdjustmentForm";
import { CloseMonthButton } from "@/components/owner/CloseMonthButton";
import { CreatorSharesTable } from "@/components/owner/CreatorSharesTable";
import { MonthPicker } from "@/components/owner/MonthPicker";
import { PayoutHistory } from "@/components/owner/PayoutHistory";
import { RevenueForm } from "@/components/owner/RevenueForm";
import { StatementCard } from "@/components/owner/StatementCard";
import { formatDay, formatMoney, formatMonth } from "@/lib/earnings/format";
import { earningsService } from "@/lib/earnings/instance";
import { ownerEarningsPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";
import { isMonthKey, nextMonth, warsawDayOf } from "@/lib/time/warsaw";

/**
 * The owner's Earnings page (docs/design/OwnerEarnings.dc.html): pick a month, enter its revenue while it is open, read the statement and each
 * creator's share, then close the month and mark each creator as paid. Reads the session and the database, so the page renders it behind
 * Suspense. Anyone who is not an owner gets a not-found page. No learner is ever shown here, only counts and creator names.
 */
export async function OwnerEarningsScreen({ month }: { month?: string }) {
  const actor = await requireOwner(ownerEarningsPath());
  const service = earningsService();
  const months = await service.listMonths(actor);
  const chosen = month && isMonthKey(month) ? month : months[0].month;
  const statement = await service.getStatement(actor, chosen);
  if (!statement) return null;

  const options = months.some((m) => m.month === chosen) ? months : [{ month: chosen, status: "open" as const }, ...months];
  const labelled = options.map((m) => ({ month: m.month, label: `${formatMonth(m.month)} · ${m.status}` }));
  const closesOn = formatDay(`${nextMonth(statement.month)}-01`);
  const monthLabel = formatMonth(statement.month);
  const names: Record<string, string> = {};
  for (const line of statement.lines) if (line.creatorId) names[line.creatorId] = line.name;

  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-wrap items-center gap-space-3">
        <div className="grow">
          <h1 className="m-0 font-display text-title text-ink">Earnings</h1>
          <p className="m-0 mt-space-1 text-body-lg text-slate">Creators share 80% of net revenue, split by counted views.</p>
        </div>
        <MonthPicker months={labelled} current={chosen} />
      </div>
      <div className="flex flex-wrap items-start gap-space-6">
        <div className="flex min-w-0 grow basis-[360px] flex-col gap-space-4">
          <StatementCard statement={statement} />
          {statement.final ? (
            <p className="m-0 rounded-lg bg-cream p-space-4 text-body text-ink">
              Closed on {statement.closedAt ? formatDay(warsawDayOf(statement.closedAt), true) : "—"}. Its numbers are locked. A correction goes in as an adjustment in the open month.
            </p>
          ) : (
            <>
              <RevenueForm key={`${statement.month}-${statement.revenue?.version ?? 0}`} month={statement.month} revenue={statement.revenue} />
              <AdjustmentForm month={statement.month} />
              {statement.adjustments.length > 0 && (
                <ul aria-label="Adjustments in this month" className="m-0 flex list-none flex-col gap-space-2 rounded-lg border border-hairline bg-paper p-space-4">
                  {statement.adjustments.map((a) => (
                    <li key={a.id} className="flex justify-between gap-space-3 text-body text-ink">
                      <span>
                        {a.note}
                        <span className="block text-caption text-slate">{formatDay(warsawDayOf(a.at), true)}</span>
                      </span>
                      <span className="font-semibold">{formatMoney(a.amountCents, a.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <CloseMonthButton month={statement.month} monthLabel={monthLabel} ended={statement.ended} revenueEntered={statement.revenue !== null} />
            </>
          )}
        </div>
        <div className="flex min-w-0 grow-[2] basis-[480px] flex-col gap-space-6">
          <div className="flex flex-col gap-space-3">
            <CreatorSharesTable statement={statement} />
            <p className="m-0 text-caption text-slate">
              {statement.final
                ? "Payouts are sent by bank transfer for now. Mark each creator as paid once you have sent it."
                : `Payouts are sent by bank transfer for now. Closing a month locks its numbers; ${monthLabel} can be closed from ${closesOn}.`}
            </p>
          </div>
          {statement.final && <PayoutHistory payouts={statement.payouts} names={names} truncated={statement.payoutsTruncated} />}
        </div>
      </div>
    </div>
  );
}
