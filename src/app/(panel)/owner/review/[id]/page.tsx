import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerReviewScreen } from "@/components/screens/OwnerReviewScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Review · Instik owner", robots: { index: false } };

type Params = { params: Promise<{ id: string }> };

async function Screen({ params }: Params) {
  const { id } = await params;
  return <OwnerReviewScreen id={id} />;
}

export default function OwnerReviewPage({ params }: Params) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Screen params={params} />
    </Suspense>
  );
}
