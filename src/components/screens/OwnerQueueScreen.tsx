import { QueueCounts } from "@/components/owner/QueueCounts";
import { QueueTable } from "@/components/owner/QueueTable";
import { reviewService } from "@/lib/review/instance";
import { ownerPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/** The review queue: four counts and the table, oldest first. Reads the session, so the page renders it behind Suspense. Anyone who is not an owner gets a not-found page. */
export async function OwnerQueueScreen() {
  const actor = await requireOwner(ownerPath());
  const queue = await reviewService().getQueue(actor, { list: "review" });
  return (
    <div className="flex flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Review queue</h1>
        <p className="m-0 text-body-lg text-slate">Oldest first. Every video needs a transcript and a review before it goes live.</p>
      </div>
      <QueueCounts counts={queue.counts} />
      <QueueTable rows={queue.rows} list="review" />
    </div>
  );
}
