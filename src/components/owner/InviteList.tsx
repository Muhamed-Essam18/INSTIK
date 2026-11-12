import type { InviteState } from "@/lib/invites/rules";
import { RevokeButton } from "./RevokeButton";

export type InviteRow = { id: string; name: string; email: string; state: InviteState; expiresAt: Date; createdAt: Date };

const stateLabel: Record<InviteState, string> = {
  pending: "Pending",
  used: "Used",
  expired: "Expired",
  revoked: "Revoked",
};

const date = (d: Date) => d.toISOString().slice(0, 10);

/** The invitations the owner has sent, newest first, with their state. Nothing here ever shows a link. */
export function InviteList({ invites }: { invites: InviteRow[] }) {
  if (invites.length === 0) return <p className="m-0 text-body text-slate">No invitations yet.</p>;
  return (
    <ul aria-label="Invitations" className="m-0 flex list-none flex-col gap-space-3 p-0">
      {invites.map((invite) => (
        <li key={invite.id} className="flex flex-wrap items-center gap-x-space-6 gap-y-space-1 rounded-md bg-paper p-space-4">
          <span className="flex min-w-0 flex-[1_1_240px] flex-col">
            <span className="text-body font-semibold text-ink">{invite.name}</span>
            <span className="break-all text-caption text-slate">{invite.email}</span>
          </span>
          <span className="text-label text-ink">{stateLabel[invite.state]}</span>
          <span className="text-caption text-slate">
            {invite.state === "pending" ? `Expires ${date(invite.expiresAt)}` : `Sent ${date(invite.createdAt)}`}
          </span>
          {invite.state === "pending" ? <RevokeButton inviteId={invite.id} name={invite.name} /> : null}
        </li>
      ))}
    </ul>
  );
}
