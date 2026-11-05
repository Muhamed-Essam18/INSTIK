import Link from "next/link";
import { Container } from "./Container";

const linkClass = "inline-flex min-h-11 items-center text-slate";

export function Footer({ hostsHref, pricingHref }: { hostsHref: string; pricingHref: string }) {
  return (
    <footer className="py-space-12">
      <Container className="flex flex-wrap items-center gap-space-6 text-[14px] text-slate">
        <span className="font-display text-[22px] font-extrabold text-ink">instik</span>
        <span>Say it: in-STICK</span>
        <div className="grow" />
        <span>About</span>
        <Link href={hostsHref} className={linkClass}>
          Hosts
        </Link>
        <Link href={pricingHref} className={linkClass}>
          Pricing
        </Link>
        <span>Privacy</span>
      </Container>
    </footer>
  );
}
