import type { Metadata } from "next";
import { Faq } from "@/components/marketing/Faq";
import { PlanCard } from "@/components/marketing/PlanCard";
import { PricingSwitch } from "@/components/marketing/PricingSwitch";
import { StartCta } from "@/components/marketing/StartLink";
import { Wrap } from "@/components/marketing/Wrap";
import { outlineButton, coralButton } from "@/components/marketing/buttons";
import { pricing } from "@/lib/marketing/copy";

export const metadata: Metadata = {
  title: "Pricing · Instik",
  description:
    "Start free with a starter set of videos, your hours counter and roadmap. Full access opens every video, every host and every stage. No ads, no streak pressure, no tricks.",
  alternates: { canonical: "/pricing" },
};

const buttonShape = "h-[52px] w-full text-[16px]";

export default function PricingPage() {
  const { free, full } = pricing;
  return (
    <Wrap max="max-w-[1040px]" className="flex flex-col gap-12 pt-12 pb-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-[36px] leading-[42px] font-extrabold md:text-[48px] md:leading-[54px]">
          {pricing.title}
        </h1>
        <p className="max-w-[560px] text-[19px] leading-[29px] text-slate">{pricing.body}</p>
      </div>
      <PricingSwitch
        free={
          <PlanCard
            name={free.name}
            tick="#0f7566"
            items={free.items}
            price={
              <>
                <span className="font-display text-[44px] leading-12 font-extrabold">{free.price}</span>
                <span className="text-slate">{free.per}</span>
              </>
            }
            cta={<StartCta className={`${outlineButton} ${buttonShape}`}>{free.cta}</StartCta>}
          />
        }
        fullCta={<StartCta className={`${coralButton} ${buttonShape}`}>{full.cta}</StartCta>}
      />
      <Faq />
    </Wrap>
  );
}
