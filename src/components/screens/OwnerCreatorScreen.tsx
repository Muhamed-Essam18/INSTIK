import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorStats } from "@/components/owner/CreatorStats";
import { PauseButton } from "@/components/owner/PauseButton";
import { creatorsService } from "@/lib/creators/instance";
import { ownerCreatorPath, ownerCreatorsPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/** One creator: their status, pause or resume, and content counts. An unknown id, or an account that is not a creator, is not found. Owners only. */
export async function OwnerCreatorScreen({ id }: { id: string }) {
  const actor = await requireOwner(ownerCreatorPath(id));
  const stats = await creatorsService().getCreatorStats(actor, id);
  if (!stats) notFound();
  return (
    <div className="flex flex-col gap-space-8">
      <Link href={ownerCreatorsPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        Creators
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-space-4">
        <div className="flex flex-col gap-space-2">
          <h1 className="m-0 font-display text-title text-ink">{stats.name}</h1>
          <p className="m-0 text-body-lg text-slate">
            {stats.status} · {stats.email}
          </p>
        </div>
        <PauseButton creatorId={stats.id} name={stats.name} paused={stats.status === "Paused"} />
      </div>
      <CreatorStats stats={stats} />
    </div>
  );
}
