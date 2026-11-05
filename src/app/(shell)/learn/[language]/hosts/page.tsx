import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { getHosts } from "@/lib/content";
import { hostPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Hosts · Instik" };

/** There is no hosts index screen; the Hosts item opens the first host. */
async function OpenFirstHost({ params }: { params: Promise<{ language: string }> }) {
  const { language } = await params;
  const first = getHosts(language)[0];
  if (!first) notFound(); // a language without content shows its coming-soon notice instead (language layout)
  return redirect(hostPath(language, first.slug));
}

export default function HostsPage({ params }: { params: Promise<{ language: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <OpenFirstHost params={params} />
    </Suspense>
  );
}
