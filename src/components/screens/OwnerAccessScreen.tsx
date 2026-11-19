import { GrantForm } from "@/components/owner/GrantForm";
import { GrantHistory } from "@/components/owner/GrantHistory";
import { grantsService } from "@/lib/grants/instance";
import { ownerAccessPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/**
 * The owner's Access page: give or remove Full access for any account by hand, with every change recorded. A utility screen for the Instik team only,
 * built from the owner components and tokens (constitution VI). Reads the session and the database, so the page renders it behind Suspense.
 * Anyone who is not an owner gets a not-found page.
 */
export async function OwnerAccessScreen() {
  const actor = await requireOwner(ownerAccessPath());
  const view = await grantsService().listGrants(actor);
  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Full access</h1>
        <p className="m-0 text-body-lg text-slate">Give or remove Full access for an account by hand. Every change is recorded.</p>
      </div>
      <GrantForm />
      <GrantHistory view={view} />
    </div>
  );
}
