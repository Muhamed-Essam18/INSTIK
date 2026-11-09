import Link from "next/link";
import { defaultLanguage } from "@/lib/languages";
import { nav } from "@/lib/marketing/copy";
import { hostsPath, landingPath } from "@/lib/routes";
import { headerButton } from "./buttons";
import { LogInSlot } from "./LogInSlot";
import { MarketingNav } from "./MarketingNav";
import { StartCta } from "./StartLink";
import { Wrap } from "./Wrap";

export function MarketingHeader() {
  return (
    <header>
      <Wrap className="flex flex-wrap items-center gap-6 py-5">
        <Link
          href={landingPath()}
          className="flex min-h-11 items-center font-display text-[30px] leading-[34px] font-extrabold text-ink no-underline hover:text-ink"
        >
          instik
        </Link>
        <MarketingNav hostsHref={hostsPath(defaultLanguage.slug)} />
        <div className="grow" />
        <LogInSlot />
        <StartCta className={headerButton}>{nav.start}</StartCta>
      </Wrap>
    </header>
  );
}
