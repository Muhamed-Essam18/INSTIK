import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { WatchScreen } from "@/components/screens/WatchScreen";
import { getVideo } from "@/lib/content";
import { sampleVideoParams } from "@/lib/content/static-params";

type Params = Promise<{ language: string; video: string }>;

// Samples from the content files so the build needs no database; every video is read from the database when opened.
export function generateStaticParams() {
  return sampleVideoParams();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { language, video } = await params;
  return { title: `${(await getVideo(language, video))?.title ?? "Watch"} · Instik` };
}

export default function WatchVideoPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WatchScreen params={params} />
    </Suspense>
  );
}
