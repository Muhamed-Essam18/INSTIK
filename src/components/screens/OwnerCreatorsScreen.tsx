import Link from "next/link";
import { InviteForm } from "@/components/owner/InviteForm";
import { InviteList } from "@/components/owner/InviteList";
import { inviteService } from "@/lib/invites/instance";
import { ownerCreatorsPath, ownerPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/** The invite form and the invitations sent. Reads the session and the invitations, so the page renders it behind Suspense. Anyone who is not an owner gets a not-found page. */
export async function OwnerCreatorsScreen() {
  const actor = await requireOwner(ownerCreatorsPath());
  const invites = await inviteService().listInvites({ actor });
  return (
    <div className="flex flex-col gap-space-8">
      <div className="flex flex-col gap-space-2">
        <h1 className="m-0 font-display text-title text-ink">Creators</h1>
        <p className="m-0 text-body-lg text-slate">
          Invite someone to create on Instik. They get a link that works once and lasts 7 days.
        </p>
      </div>
      <InviteForm />
      <section aria-labelledby="sent" className="flex flex-col gap-space-4">
        <h2 id="sent" className="m-0 font-display text-[28px] leading-[34px] font-extrabold">
          Invitations
        </h2>
        <InviteList invites={invites} />
      </section>
      <Link href={ownerPath()} className="inline-flex min-h-11 items-center self-start text-label underline">
        Back to the owner area
      </Link>
    </div>
  );
}
