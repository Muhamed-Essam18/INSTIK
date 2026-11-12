import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptInvite } from "@/components/owner/AcceptInvite";
import { inviteService } from "@/lib/invites/instance";
import { ALREADY_PRIVILEGED, INVALID_LINK, WRONG_EMAIL } from "@/lib/invites/messages";
import { emailsMatch } from "@/lib/invites/rules";
import { creatorPath, invitePath, ownerPath, signInPath } from "@/lib/routes";
import { getActor } from "@/lib/session";

const Message = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mx-auto flex max-w-[720px] flex-col gap-space-4">
    <h1 className="m-0 font-display text-title text-ink">{title}</h1>
    {children}
  </div>
);

const linkClass = "inline-flex min-h-11 items-center self-start text-label underline";

/**
 * The invitation page (contracts/routes-and-actions.md). One calm message for every link that cannot be used, and
 * nothing changes until a signed-in account with the invited email presses Accept. Reads the token and the session,
 * so it renders behind a Suspense boundary.
 */
export async function InviteScreen({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await inviteService().previewInvite(token);
  if (!preview.ok) {
    return (
      <Message title="This invitation can't be used">
        <p className="m-0 text-body-lg text-slate">{INVALID_LINK}</p>
      </Message>
    );
  }

  const actor = await getActor();
  if (!actor) redirect(signInPath(invitePath(token)));

  if (actor.role !== "learner") {
    const area = actor.role === "owner" ? ownerPath() : creatorPath();
    return (
      <Message title="You're all set">
        <p className="m-0 text-body-lg text-slate">{ALREADY_PRIVILEGED}</p>
        <Link href={area} className={linkClass}>
          {actor.role === "owner" ? "Go to the owner area" : "Go to the creator area"}
        </Link>
      </Message>
    );
  }

  // The invitation belongs to the address it was sent to; the page never says which address that was.
  if (!emailsMatch(preview.email, actor.email)) {
    return (
      <Message title="Use the invited address">
        <p className="m-0 text-body-lg text-slate">{WRONG_EMAIL}</p>
        <Link href={signInPath(invitePath(token))} className={linkClass}>
          Sign in with another address
        </Link>
      </Message>
    );
  }

  return (
    <Message title={`Welcome, ${preview.name}`}>
      <p className="m-0 text-body-lg text-slate">
        The Instik team has invited you to create videos on Instik. Accepting gives you a creator area and your own host page.
      </p>
      <AcceptInvite token={token} />
    </Message>
  );
}
