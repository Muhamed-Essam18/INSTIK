"use client";

import { useContext } from "react";
import { coralButton } from "@/components/marketing/buttons";
import { PeriodContext } from "@/components/marketing/PricingSwitch";
import { pricing } from "@/lib/marketing/copy";
import { billingStartPath } from "@/lib/routes";

/**
 * The Full access button when billing is on: a plain link (not prefetched, and it works without scripts) to the
 * checkout start route for the period the visitor has selected on the switch.
 */
export function FullAccessAction() {
  const period = useContext(PeriodContext);
  return (
    <a href={billingStartPath(period)} className={`${coralButton} h-[52px] w-full text-[16px]`}>
      {pricing.full.cta}
    </a>
  );
}
