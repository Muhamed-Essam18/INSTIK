import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerCreatorsScreen } from "@/components/screens/OwnerCreatorsScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Creators · Instik", robots: { index: false } };

export default function CreatorsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OwnerCreatorsScreen />
    </Suspense>
  );
}
