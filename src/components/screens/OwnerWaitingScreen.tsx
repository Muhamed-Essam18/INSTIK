import Link from "next/link";
import { QueueTable } from "@/components/owner/QueueTable";
import { reviewService } from "@/lib/review/instance";
import { ownerPath, ownerWaitingPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/** Videos in Changes requested, oldest first, each opening its review screen read-only. Owners only. */
export async function OwnerWaitingScreen() {
  const actor = await requireOwner(ownerWaitingPath());
  const queue = await reviewService().getQueue(actor, { list: "waiting" });
  return (
    <div className="flex flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Waiting on creators</h1>
        <p className="m-0 text-body-lg text-slate">These videos have changes requested. They come back to the queue when the creator sends a new version.</p>
      </div>
      <QueueTable rows={queue.rows} list="waiting" />
      <Link href={ownerPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        Back to the review queue
      </Link>
    </div>
  );
}
