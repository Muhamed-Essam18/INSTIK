import Link from "next/link";
import { defaultLanguage } from "@/lib/languages";
import { footer } from "@/lib/marketing/copy";
import { aboutPath, hostsPath, pricingPath, privacyPath } from "@/lib/routes";
import { Wrap } from "./Wrap";

const linkClass = "inline-flex min-h-11 items-center text-slate";

export function MarketingFooter() {
  return (
    <footer className="py-12">
      <Wrap className="flex flex-wrap items-center gap-6 text-[14px] text-slate">
        <span className="font-display text-[22px] font-extrabold text-ink">instik</span>
        <span>{footer.say}</span>
        <div className="grow" />
        <Link href={aboutPath()} className={linkClass}>
          {footer.about}
        </Link>
        <Link href={hostsPath(defaultLanguage.slug)} className={linkClass}>
          {footer.hosts}
        </Link>
        <Link href={pricingPath()} className={linkClass}>
          {footer.pricing}
        </Link>
        <Link href={privacyPath()} className={linkClass}>
          {footer.privacy}
        </Link>
      </Wrap>
    </footer>
  );
}
