import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerEarningsScreen } from "@/components/screens/OwnerEarningsScreen";
import { PageFallback } from "@/components/screens/PageFallback";

export const metadata: Metadata = { title: "Earnings · Instik owner", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Earnings({ searchParams }: { searchParams: SearchParams }) {
  const { month } = await searchParams;
  return <OwnerEarningsScreen month={typeof month === "string" ? month : undefined} />;
}

/** Reads the session, the database and the query string, so it renders behind Suspense. A bad month falls back to the current one. */
export default function OwnerEarningsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Earnings searchParams={searchParams} />
    </Suspense>
  );
}
