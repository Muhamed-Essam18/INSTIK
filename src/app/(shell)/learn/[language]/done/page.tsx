import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { defaultLanguage } from "@/lib/languages";
import { roadmapPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Done for today · Instik" };

export default function DonePage() {
  return (
    <PlaceholderPage
      title="Done for today"
      note="That's enough for today. See you tomorrow."
      backHref={roadmapPath(defaultLanguage.slug)}
      backLabel="See your roadmap"
    />
  );
}
