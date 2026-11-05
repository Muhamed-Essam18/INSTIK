import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { landingPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Pricing · Instik" };

export default function PricingPage() {
  return (
    <PlaceholderPage
      title="Pricing"
      note="Pricing is on its way. Check back soon."
      backHref={landingPath()}
      backLabel="Back to the start"
    />
  );
}
