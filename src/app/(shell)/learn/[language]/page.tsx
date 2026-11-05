import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryScreen } from "@/components/screens/LibraryScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Library · Instik" };

export default function LibraryPage({ params }: { params: Promise<{ language: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LibraryScreen params={params} />
    </Suspense>
  );
}
