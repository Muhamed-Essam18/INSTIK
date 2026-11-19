import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerRequestsScreen } from "@/components/screens/OwnerRequestsScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Requests · Instik owner", robots: { index: false } };

/** Reads the session and the database, so it renders behind Suspense. */
export default function OwnerRequestsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OwnerRequestsScreen />
    </Suspense>
  );
}
