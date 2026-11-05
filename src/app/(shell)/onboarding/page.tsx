import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { landingPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Get started · Instik" };

export default function OnboardingPage() {
  return (
    <PlaceholderPage
      title="Get started"
      note="Getting started is on its way. Check back soon."
      backHref={landingPath()}
      backLabel="Back to the start"
    />
  );
}
