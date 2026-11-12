import Link from "next/link";
import { languages } from "@/lib/languages";
import { signInPath } from "@/lib/routes";
import { panelLinksFor } from "@/lib/roles/panels";
import { getActor, getLearner } from "@/lib/session";
import { AccountButton } from "./AccountButton";
import { DeviceImport } from "./DeviceImport";

/** The first letter of the learner's name, or of their email address when they have no name. */
export function initialFor(learner: { name: string | null; email: string }): string {
  const source = learner.name?.trim() || learner.email.trim();
  return (Array.from(source)[0] ?? "?").toUpperCase();
}

/** Reads the session, so the header renders it behind its own Suspense boundary. */
export async function UserSlot() {
  const learner = await getLearner();
  if (!learner) {
    return (
      <Link
        href={signInPath()}
        className="inline-flex min-h-11 items-center rounded-md px-space-3 text-label text-ink underline"
      >
        Sign in
      </Link>
    );
  }
  // The role is read again on every request (never kept in the session), so a changed role shows at the next page.
  // If it cannot be read the menu simply has no panel entry; the pages still check the role themselves.
  const actor = await getActor().catch(() => null);
  return (
    <>
      <AccountButton initial={initialFor(learner)} panels={actor ? panelLinksFor(actor) : []} />
      <DeviceImport languages={languages.map(({ slug, code }) => ({ slug, code }))} />
    </>
  );
}
