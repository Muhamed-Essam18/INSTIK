import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatorScreen } from "@/components/screens/CreatorScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Creator · Instik", robots: { index: false } };

export default function CreatorPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <CreatorScreen />
    </Suspense>
  );
}
