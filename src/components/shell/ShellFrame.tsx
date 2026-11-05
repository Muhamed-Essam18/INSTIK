import type { ReactNode } from "react";
import { defaultLanguage } from "@/lib/languages";
import { hostsPath, pricingPath } from "@/lib/routes";
import { Container } from "./Container";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { SkipLink } from "./SkipLink";

/** The only place the skip link, header, main and footer are composed. */
export function ShellFrame({ children }: { children: ReactNode }) {
  const slug = defaultLanguage.slug;
  return (
    <>
      <SkipLink />
      <Header defaultSlug={slug} />
      <Container as="main" id="main" tabIndex={-1} className="grow py-space-12 focus:outline-none">
        {children}
      </Container>
      <Footer hostsHref={hostsPath(slug)} pricingHref={pricingPath()} />
    </>
  );
}
