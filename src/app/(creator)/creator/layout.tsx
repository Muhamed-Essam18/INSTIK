import { Suspense, type ReactNode } from "react";
import { CreatorNav, CreatorNavFallback } from "@/components/creator/CreatorNav";
import { SkipLink } from "@/components/shell/SkipLink";
import { getOwnProfile } from "@/lib/content/creator-reads";
import { creatorPath } from "@/lib/routes";
import { requireCreator } from "@/lib/session";

/** The navigation with the signed-in creator's name (from their host page, else their account). Reads the session, so it renders behind Suspense. */
async function Sidebar() {
  const actor = await requireCreator(creatorPath());
  const profile = await getOwnProfile(actor);
  return <CreatorNav signedInAs={profile?.name?.trim() || actor.name?.trim() || actor.email} />;
}

/** The creator panel: an ink navigation column beside the page (above it on a phone). Every page behind it checks the creator role itself. */
export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SkipLink />
      <Suspense fallback={<CreatorNavFallback />}>
        <Sidebar />
      </Suspense>
      <main id="main" tabIndex={-1} className="min-w-0 grow px-4 py-space-8 focus:outline-none md:px-space-12 md:py-space-12">
        {children}
      </main>
    </div>
  );
}
