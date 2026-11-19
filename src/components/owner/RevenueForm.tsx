"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { saveRevenue } from "@/lib/earnings/actions";
import { formatPlainEuros } from "@/lib/earnings/format";
import { fieldLabel, type RevenueField } from "@/lib/earnings/messages";
import type { MonthRevenue } from "@/lib/earnings/revenue-source";

const input = "min-h-11 w-full rounded-sm border border-slate bg-paper px-space-3 text-body text-ink focus-visible:outline-ink";
const fields: { field: RevenueField; name: "gross" | "vat" | "fees" | "refunds" }[] = [
  { field: "grossCents", name: "gross" },
  { field: "vatCents", name: "vat" },
  { field: "feesCents", name: "fees" },
  { field: "refundsCents", name: "refunds" },
];

/**
 * The month's revenue figures, typed as euros by an owner (until a payment gateway fills them). Saves with the version it loaded, so a
 * second owner's change is never overwritten silently. Only shown for an open month. The page remounts it with a new `key` after a save.
 */
export function RevenueForm({ month, revenue }: { month: string; revenue: MonthRevenue | null }) {
  const router = useRouter();
  const hintId = useId();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const version = revenue?.version ?? 0;
  const start = (cents: number | undefined) => (cents === undefined ? "" : formatPlainEuros(cents));

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setPending(true);
    setMessage(undefined);
    try {
      const result = await saveRevenue({
        month,
        expectedVersion: version,
        gross: String(data.get("gross") ?? ""),
        vat: String(data.get("vat") ?? ""),
        fees: String(data.get("fees") ?? ""),
        refunds: String(data.get("refunds") ?? ""),
      });
      setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.message });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "That didn't save. Please try again." });
    }
    setPending(false);
  }

  return (
    <form
      aria-label="Revenue for this month"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
      className="flex flex-col gap-space-4 rounded-lg border border-hairline bg-paper p-space-6"
    >
      <p id={hintId} className="m-0 text-caption text-slate">
        Enter this month&apos;s figures in euros. They stay editable until you close the month.
      </p>
      <div className="grid gap-space-4 sm:grid-cols-2">
        {fields.map(({ field, name }) => (
          <label key={name} className="flex flex-col gap-space-1 text-label text-ink">
            {fieldLabel[field]}
            <input
              name={name}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={start(revenue?.[field])}
              aria-describedby={hintId}
              className={input}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-space-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-coral px-space-6 text-label font-semibold text-ink disabled:opacity-60"
        >
          Save figures
        </button>
        {message && (
          <span role={message.ok ? "status" : "alert"} className={`text-label ${message.ok ? "text-teal-text" : "text-coral-text"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
