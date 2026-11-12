import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/screens/PageFallback";
import { InviteScreen } from "@/components/screens/InviteScreen";
import { Container } from "@/components/shell/Container";

export const metadata: Metadata = { title: "Invitation · Instik", robots: { index: false } };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Container as="main" id="main" tabIndex={-1} className="grow py-space-12 focus:outline-none">
      <Suspense fallback={<PageFallback />}>
        <InviteScreen params={params} />
      </Suspense>
    </Container>
  );
}
