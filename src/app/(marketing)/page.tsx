import type { Metadata } from "next";
import { FinalCta } from "@/components/marketing/FinalCta";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { IsThisAi } from "@/components/marketing/IsThisAi";
import { LandingHero } from "@/components/marketing/LandingHero";
import { Pillars } from "@/components/marketing/Pillars";
import { Stages } from "@/components/marketing/Stages";
import { WaitlistSection } from "@/components/marketing/WaitlistSection";
import { Wrap } from "@/components/marketing/Wrap";
import { tagline } from "@/lib/site";

export const metadata: Metadata = {
  title: `Instik — ${tagline}`,
  description:
    "Watch real native speakers at your level and see every honest hour add up toward a roadmap. No drills, no tests, no streak panic. Now teaching Egyptian Arabic.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <Pillars />
      <HowItWorks />
      <Stages />
      <Wrap className="flex flex-wrap gap-12 py-16 md:py-24">
        <WaitlistSection />
        <IsThisAi />
      </Wrap>
      <FinalCta />
    </>
  );
}
