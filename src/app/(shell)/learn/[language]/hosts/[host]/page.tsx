import type { Metadata } from "next";
import { Suspense } from "react";
import { HostScreen } from "@/components/screens/HostScreen";
import { PageFallback } from "@/components/screens/PageFallback";
import { getHost, getHosts } from "@/lib/content";
import { isAvailable, languages } from "@/lib/languages";

type Params = Promise<{ language: string; host: string }>;

export function generateStaticParams() {
  return languages
    .filter(isAvailable)
    .flatMap((l) => getHosts(l.slug).map((h) => ({ language: l.slug, host: h.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { language, host } = await params;
  return { title: `${getHost(language, host)?.name ?? "Host"} · Instik` };
}

export default function HostPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <HostScreen params={params} />
    </Suspense>
  );
}
