import { Suspense, type ReactNode } from "react";
import { CreatorNav, CreatorNavFallback } from "@/components/creator/CreatorNav";
import { SkipLink } from "@/components/shell/SkipLink";
import { getOwnProfile } from "@/lib/content/creator-reads";
import { creatorPath } from "@/lib/routes";
import { PAUSED_MESSAGE } from "@/lib/creator/messages";
import { getActor, requireCreator } from "@/lib/session";

/** The navigation with the signed-in creator's name (from their host page, else their account). Reads the session, so it renders behind Suspense. */
async function Sidebar() {
  const actor = await requireCreator(creatorPath());
  const profile = await getOwnProfile(actor);
  return <CreatorNav signedInAs={profile?.name?.trim() || actor.name?.trim() || actor.email} />;
}

/** A calm line on every creator page while an owner has paused this creator. Reads the session, so it renders behind Suspense. */
async function PausedNotice() {
  const actor = await getActor();
  if (!actor?.paused) return null;
  return (
    <p role="status" className="m-0 mb-space-6 rounded-lg border border-hairline bg-paper p-space-4 text-body text-ink">
      {PAUSED_MESSAGE}
    </p>
  );
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
        <Suspense fallback={null}>
          <PausedNotice />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
