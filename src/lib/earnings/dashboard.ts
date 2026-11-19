import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { buildDashboard, type DashboardData } from "./dashboard-data";
import { prismaRequestsStore } from "@/lib/requests/store";
import { createManualRevenueSource } from "./revenue-source";
import { prismaDashboardStore, prismaEarningsStore } from "./store";

// The cached dashboard reader (spec 11 FR-008, research.md section 10). It is a DEPENDENCY of the earnings service, not a public helper:
// only `instance.ts` imports it and passes it in. The service resolves the creator id from the signed-in actor and passes plain strings,
// so a cache entry is one creator's data and nothing else can ask for another creator's dashboard by id.
//
// The entry lives about a minute (`revalidate: 60`, `expire: 300`) and carries three tags: one creator, every creator's earnings, and requests. Owner actions that change what a creator sees
// (revenue saved, month closed, payout marked or reversed, a request posted) call `updateTag` for them.

export async function readCreatorDashboard(creatorId: string, month: string, minute: string): Promise<DashboardData> {
  "use cache";
  cacheLife({ revalidate: 60, expire: 300 });
  cacheTag(`creator-stats:${creatorId}`, "creator-earnings", "creator-requests");
  const revenue = createManualRevenueSource((m) => prismaEarningsStore.getRevenue(m));
  // The open requests (newest first, at most 20) are the same for every creator; they sit in the entry and are expired by the "creator-requests" tag.
  const openRequests = async () => (await prismaRequestsStore.listOpen(20)).map((r) => ({ id: r.id, stage: r.stage, topic: r.topic, text: r.text }));
  return buildDashboard({ store: prismaDashboardStore, revenue, openRequests }, creatorId, month, new Date(minute));
}
