import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerWaitingScreen } from "@/components/screens/OwnerWaitingScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Waiting on creators · Instik", robots: { index: false } };

export default function OwnerWaitingPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OwnerWaitingScreen />
    </Suspense>
  );
}
