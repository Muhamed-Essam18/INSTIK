import { PlaceholderPage } from "@/components/PlaceholderPage";
import { landingPath, ownerCreatorsPath, ownerPath } from "@/lib/routes";
import { requireOwner } from "@/lib/session";

/** The owner area's home, empty for now. Reads the session, so the page renders it behind Suspense. Anyone who is not an owner gets a not-found page. */
export async function OwnerScreen() {
  const actor = await requireOwner(ownerPath());
  return (
    <PlaceholderPage
      title={actor.name ? `Hello, ${actor.name}` : "Hello"}
      note="Nothing here yet. The review queue and earnings will appear here."
      backHref={landingPath()}
      backLabel="Back to Instik"
      moreLinks={[{ href: ownerCreatorsPath(), label: "Creators and invitations" }]}
    />
  );
}
