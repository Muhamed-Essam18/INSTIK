import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerScreen } from "@/components/screens/OwnerScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Owner · Instik", robots: { index: false } };

export default function OwnerPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OwnerScreen />
    </Suspense>
  );
}
