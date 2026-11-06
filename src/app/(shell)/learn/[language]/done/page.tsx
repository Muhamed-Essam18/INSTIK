import type { Metadata } from "next";
import { Suspense } from "react";
import { DoneScreen } from "@/components/screens/DoneScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Done for today · Instik" };

export default function DonePage({ params }: { params: Promise<{ language: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <DoneScreen params={params} />
    </Suspense>
  );
}
