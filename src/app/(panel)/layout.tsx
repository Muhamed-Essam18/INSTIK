import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/shell/Container";
import { SkipLink } from "@/components/shell/SkipLink";
import { landingPath } from "@/lib/routes";

/** A quiet frame for the creator and owner areas: the same width and tokens as the site, with none of the learner navigation. */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-hairline">
        <Container className="flex items-center gap-space-6 py-space-4">
          <Link
            href={landingPath()}
            className="flex min-h-11 items-center font-display text-[28px] leading-8 font-extrabold text-ink no-underline hover:text-ink"
          >
            instik
          </Link>
        </Container>
      </header>
      <Container as="main" id="main" tabIndex={-1} className="grow py-space-12 focus:outline-none">
        {children}
      </Container>
    </>
  );
}
