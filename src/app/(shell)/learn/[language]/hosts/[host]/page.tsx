import type { Metadata } from "next";
import { Suspense } from "react";
import { HostScreen } from "@/components/screens/HostScreen";
import { PageFallback } from "@/components/screens/PageFallback";
import { getHost } from "@/lib/content";
import { sampleHostParams } from "@/lib/content/static-params";

type Params = Promise<{ language: string; host: string }>;

// Samples from the content files so the build needs no database; every host is read from the database when opened.
export function generateStaticParams() {
  return sampleHostParams();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { language, host } = await params;
  return { title: `${(await getHost(language, host))?.name ?? "Host"} · Instik` };
}

export default function HostPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <HostScreen params={params} />
    </Suspense>
  );
}
