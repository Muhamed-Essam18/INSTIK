import Link from "next/link";
import { Suspense } from "react";
import { landingPath } from "@/lib/routes";
import { Container } from "./Container";
import { HoursPillFallback, HoursPillSlot } from "./HoursPillSlot";
import { MainNav, MainNavFallback } from "./MainNav";
import { UserSlot } from "./UserSlot";

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
        <Suspense fallback={<HoursPillFallback defaultSlug={defaultSlug} />}>
          <HoursPillSlot defaultSlug={defaultSlug} />
        </Suspense>
        <Suspense fallback={<span className="size-11" aria-hidden="true" />}>
          <UserSlot />
        </Suspense>
      </Container>
    </header>
  );
}
