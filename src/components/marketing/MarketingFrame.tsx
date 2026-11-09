import type { ReactNode } from "react";
import { SkipLink } from "@/components/shell/SkipLink";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

/** The only place the marketing skip link, header, main and footer are composed. */
export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <MarketingHeader />
      <main id="main" tabIndex={-1} className="grow focus:outline-none">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
