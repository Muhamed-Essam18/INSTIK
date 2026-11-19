import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerAccessScreen } from "@/components/screens/OwnerAccessScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Full access · Instik owner", robots: { index: false } };

/** Reads the session and the database, so it renders behind Suspense. */
export default function OwnerAccessPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OwnerAccessScreen />
    </Suspense>
  );
}
