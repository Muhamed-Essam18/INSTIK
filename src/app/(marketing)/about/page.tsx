import type { Metadata } from "next";
import Link from "next/link";
import { coralButton } from "@/components/marketing/buttons";
import { Prose, ProseSection } from "@/components/marketing/Prose";
import { StartCta } from "@/components/marketing/StartLink";
import { defaultLanguage } from "@/lib/languages";
import { about } from "@/lib/marketing/copy";
import { hostsPath } from "@/lib/routes";

export const metadata: Metadata = {
  title: "About · Instik",
  description: about.description,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Prose title={about.title}>
      <ProseSection title={about.say.title}>
        <p>{about.say.body}</p>
      </ProseSection>
      <ProseSection title={about.method.title}>
        {about.method.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </ProseSection>
      <ProseSection title={about.hosts.title}>
        {about.hosts.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>
          <Link href={hostsPath(defaultLanguage.slug)} className="inline-flex min-h-11 items-center font-semibold">
            {about.hosts.link}
          </Link>
        </p>
      </ProseSection>
      <div>
        <StartCta className={`${coralButton} h-14 px-7 text-[17px]`}>{about.cta}</StartCta>
      </div>
    </Prose>
  );
}
