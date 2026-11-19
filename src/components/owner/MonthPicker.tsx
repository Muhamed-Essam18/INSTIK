"use client";

import { useRouter } from "next/navigation";
import { ownerEarningsPath } from "@/lib/routes";

/** The month select of the Earnings page. It also works without JavaScript through the Show button (a plain GET form). */
export function MonthPicker({ months, current }: { months: { month: string; label: string }[]; current: string }) {
  const router = useRouter();
  return (
    <form action={ownerEarningsPath()} method="get" className="flex items-center gap-space-2">
      <label className="sr-only" htmlFor="month">
        Month
      </label>
      <select
        id="month"
        name="month"
        defaultValue={current}
        onChange={(event) => router.push(ownerEarningsPath(event.target.value))}
        className="min-h-11 rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink"
      >
        {months.map((m) => (
          <option key={m.month} value={m.month}>
            {m.label}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-11 px-space-3 text-label underline">
        Show
      </button>
    </form>
  );
}
