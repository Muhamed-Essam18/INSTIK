import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { defaultLanguage } from "@/lib/languages";
import { libraryPath, onboardingPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Instik — Your scroll time, but it counts." };

export default function LandingPage() {
  return (
    <PlaceholderPage
      title="Instik"
      note="Your scroll time, but it counts. This page is on its way."
      backHref={onboardingPath()}
      backLabel="Get started"
      moreLinks={[{ href: libraryPath(defaultLanguage.slug), label: "Go to the Library" }]}
    />
  );
}
