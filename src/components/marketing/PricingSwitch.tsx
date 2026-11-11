"use client";

import { createContext, useState, type ReactNode } from "react";
import { periodLabel, priceLabel, savingLabel, type Period } from "@/lib/billing/plans";
import { pricing } from "@/lib/marketing/copy";
import { PlanCard } from "./PlanCard";

/** The selected billing period, for the Full access button (a client child rendered by the server) to read. */
export const PeriodContext = createContext<Period>("monthly");

const priceClass = "font-display text-[44px] leading-12 font-extrabold";

/** The Monthly/Yearly switch and the Full access card it changes. The Free card is passed in and never changes. */
export function PricingSwitch({ free, fullCta }: { free: ReactNode; fullCta: ReactNode }) {
  const [period, setPeriod] = useState<(typeof pricing.periods)[number]>("Monthly");
  const yearly = period === "Yearly";
  const selected: Period = yearly ? "yearly" : "monthly";
  const { full } = pricing;

  return (
    <PeriodContext.Provider value={selected}>
      <div
        role="group"
        aria-label={pricing.periodLabel}
        className="mt-2 flex self-center rounded-pill bg-paper p-1"
      >
        {pricing.periods.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={period === label}
            onClick={() => setPeriod(label)}
            className={`h-11 rounded-pill px-[22px] text-[15px] font-semibold ${
              period === label ? "bg-ink text-cream" : "bg-transparent text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
        {free}
        <PlanCard
          dark
          name={full.name}
          tick="#19a38f"
          items={full.items}
          badge={
            yearly ? (
              <span className="rounded-pill bg-sun px-3 py-1 text-caption text-ink">{savingLabel()}</span>
            ) : null
          }
          price={
            <>
              <span className={priceClass}>{priceLabel(selected)}</span>
              <span>{periodLabel(selected)}</span>
            </>
          }
          cta={fullCta}
        />
      </div>
    </PeriodContext.Provider>
  );
}
