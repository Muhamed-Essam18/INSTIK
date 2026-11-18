import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerQueueScreen } from "@/components/screens/OwnerQueueScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Owner · Instik", robots: { index: false } };

export default function OwnerPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OwnerQueueScreen />
    </Suspense>
  );
}
