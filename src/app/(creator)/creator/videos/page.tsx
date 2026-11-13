import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { StatusFilters } from "@/components/creator/StatusFilters";
import { VideoTable } from "@/components/creator/VideoTable";
import { listOwnVideos } from "@/lib/content/creator-reads";
import { rowsFor } from "@/lib/creator/list";
import { countByFilter, filters, parseFilter } from "@/lib/creator/rules";
import { creatorUploadPath, creatorVideosPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

export const metadata: Metadata = { title: "My videos · Instik creator", robots: { index: false } };

type Params = { searchParams: Promise<{ status?: string | string[] }> };

async function VideosScreen({ searchParams }: Params) {
  const { status } = await searchParams;
  const actor = await requireCreator(creatorVideosPath());
  const filter = parseFilter(status);
  const videos = await listOwnVideos(actor);
  const now = new Date();
  const counts = countByFilter(videos, now);
  const rows = rowsFor(videos, filter, now);
  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-wrap items-center justify-between gap-space-4">
        <h1 className="m-0 font-display text-title text-ink">My videos</h1>
        <Link href={creatorUploadPath()} className="inline-flex min-h-12 items-center rounded-md bg-coral px-space-6 text-body font-semibold text-ink no-underline hover:text-ink">
          Upload a video
        </Link>
      </div>
      <StatusFilters current={filter} counts={counts} />
      <VideoTable rows={rows} filterLabel={filters.find((f) => f.key === filter)!.label} />
    </div>
  );
}

export default function VideosPage({ searchParams }: Params) {
  return (
    <Suspense fallback={<PageFallback />}>
      <VideosScreen searchParams={searchParams} />
    </Suspense>
  );
}
