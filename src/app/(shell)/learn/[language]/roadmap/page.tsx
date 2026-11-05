import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { defaultLanguage } from "@/lib/languages";
import { libraryPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Roadmap · Instik" };

export default function RoadmapPage() {
  return (
    <PlaceholderPage
      title="Roadmap"
      note="Your roadmap is on its way."
      backHref={libraryPath(defaultLanguage.slug)}
      backLabel="Back to the Library"
    />
  );
}
