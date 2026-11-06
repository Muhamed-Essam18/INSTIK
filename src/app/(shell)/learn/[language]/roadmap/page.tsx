import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { RoadmapScreen } from "@/components/screens/RoadmapScreen";

export const metadata: Metadata = { title: "Roadmap · Instik" };

export default function RoadmapPage({ params }: { params: Promise<{ language: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <RoadmapScreen params={params} />
    </Suspense>
  );
}
