import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { WatchScreen } from "@/components/screens/WatchScreen";
import { getVideo, getVideos } from "@/lib/content";
import { isAvailable, languages } from "@/lib/languages";

type Params = Promise<{ language: string; video: string }>;

export function generateStaticParams() {
  return languages
    .filter(isAvailable)
    .flatMap((l) => getVideos(l.slug).map((v) => ({ language: l.slug, video: v.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { language, video } = await params;
  return { title: `${getVideo(language, video)?.title ?? "Watch"} · Instik` };
}

export default function WatchVideoPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WatchScreen params={params} />
    </Suspense>
  );
}
