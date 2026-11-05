import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { defaultLanguage } from "@/lib/languages";
import { libraryPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Hosts · Instik" };

export default function HostsPage() {
  return (
    <PlaceholderPage
      title="Hosts"
      note="Meet your hosts soon."
      backHref={libraryPath(defaultLanguage.slug)}
      backLabel="Back to the Library"
    />
  );
}
