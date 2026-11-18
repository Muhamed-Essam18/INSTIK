import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerCreatorScreen } from "@/components/screens/OwnerCreatorScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Creator · Instik owner", robots: { index: false } };

type Params = { params: Promise<{ id: string }> };

async function Screen({ params }: Params) {
  const { id } = await params;
  return <OwnerCreatorScreen id={id} />;
}

export default function OwnerCreatorPage({ params }: Params) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Screen params={params} />
    </Suspense>
  );
}
