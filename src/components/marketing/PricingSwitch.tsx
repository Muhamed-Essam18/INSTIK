"use client";

import { useState, type ReactNode } from "react";
import { pricing } from "@/lib/marketing/copy";
import { PlanCard } from "./PlanCard";

const priceClass = "font-display text-[44px] leading-12 font-extrabold";

/** The Monthly/Yearly switch and the Full access card it changes. The Free card is passed in and never changes. */
export function PricingSwitch({ free, fullCta }: { free: ReactNode; fullCta: ReactNode }) {
  const [period, setPeriod] = useState<(typeof pricing.periods)[number]>("Monthly");
  const yearly = period === "Yearly";
  const { full } = pricing;

  return (
    <>
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
              <span className="rounded-pill bg-sun px-3 py-1 text-caption text-ink">{full.saving}</span>
            ) : null
          }
          price={
            <>
              <span className={priceClass}>{yearly ? full.priceYearly : full.priceMonthly}</span>
              <span>{yearly ? full.perYearly : full.perMonthly}</span>
            </>
          }
          cta={fullCta}
        />
      </div>
    </>
  );
}
