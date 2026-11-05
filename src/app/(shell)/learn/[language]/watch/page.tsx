import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { defaultLanguage } from "@/lib/languages";
import { donePath, libraryPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Watch · Instik" };

export default function WatchPage() {
  return (
    <PlaceholderPage
      title="Watch"
      note="The player is on its way."
      backHref={libraryPath(defaultLanguage.slug)}
      backLabel="Back to the Library"
      moreLinks={[{ href: donePath(defaultLanguage.slug), label: "Finish for today" }]}
    />
  );
}
