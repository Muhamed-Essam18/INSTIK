import Link from "next/link";
import { Suspense } from "react";
import { landingPath, roadmapPath } from "@/lib/routes";
import { AccountButton } from "./AccountButton";
import { Container } from "./Container";
import { HoursPill } from "./HoursPill";
import { MainNav, MainNavFallback } from "./MainNav";

export function Header({ defaultSlug }: { defaultSlug: string }) {
  return (
    <header className="border-b border-hairline">
      <Container className="flex flex-wrap items-center gap-space-6 py-space-4">
        <Link
          href={landingPath()}
          className="flex min-h-11 items-center font-display text-[28px] leading-8 font-extrabold text-ink no-underline hover:text-ink"
        >
          instik
        </Link>
        <Suspense fallback={<MainNavFallback defaultSlug={defaultSlug} />}>
          <MainNav defaultSlug={defaultSlug} />
        </Suspense>
        <div className="grow" />
        <HoursPill href={roadmapPath(defaultSlug)} />
        <AccountButton />
      </Container>
    </header>
  );
}
