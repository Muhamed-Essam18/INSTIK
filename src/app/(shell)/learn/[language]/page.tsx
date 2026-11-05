import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { TargetText } from "@/components/TargetText";
import { defaultLanguage } from "@/lib/languages";
import { roadmapPath, watchPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Library · Instik" };

export default function LibraryPage() {
  return (
    <PlaceholderPage
      title="Library"
      note="Your videos are on their way."
      backHref={roadmapPath(defaultLanguage.slug)}
      backLabel="See your roadmap"
      moreLinks={[{ href: watchPath(defaultLanguage.slug), label: "Start watching" }]}
    >
      <p className="text-body text-slate">
        A taste of what you will read: <TargetText language={defaultLanguage}>إزَّيَّك؟ عامل إيه النهارده؟</TargetText> (How are you? How is your day?)
      </p>
    </PlaceholderPage>
  );
}
