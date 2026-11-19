import { RequestForm } from "@/components/owner/RequestForm";
import { RequestsTable } from "@/components/owner/RequestsTable";
import { requestsService } from "@/lib/requests/instance";
import { ownerRequestsPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/**
 * The owner's Requests page: write what learners need next, and edit or close earlier requests. Every creator sees the open ones on their dashboard.
 * A utility screen for the Instik team only, built from the owner components and tokens (constitution VI). Reads the session and the database, so the
 * page renders it behind Suspense. Anyone who is not an owner gets a not-found page.
 */
export async function OwnerRequestsScreen() {
  const actor = await requireOwner(ownerRequestsPath());
  const requests = await requestsService().listAllRequests(actor);
  return (
    <div className="flex flex-col gap-space-6">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Requests</h1>
        <p className="m-0 text-body-lg text-slate">Tell creators what learners need next. Every creator sees the open requests on their dashboard.</p>
      </div>
      <RequestForm />
      <section aria-labelledby="all-requests" className="flex flex-col gap-space-3">
        <h2 id="all-requests" className="m-0 font-display text-heading text-ink">
          All requests
        </h2>
        <RequestsTable requests={requests} />
        {requests.length >= 100 && <p className="m-0 text-caption text-slate">Showing the latest 100 requests.</p>}
      </section>
    </div>
  );
}
