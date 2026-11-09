import type { Metadata } from "next";
import { Prose, ProseSection } from "@/components/marketing/Prose";
import { privacy } from "@/lib/marketing/copy";

export const metadata: Metadata = {
  title: "Privacy · Instik",
  description: privacy.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Prose title={privacy.title}>
      <p className="text-[17px] leading-[27px]">{privacy.intro}</p>
      <ProseSection title={privacy.listTitle}>
        <ul className="flex list-disc flex-col gap-2 pl-6">
          {privacy.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{privacy.closing}</p>
      </ProseSection>
    </Prose>
  );
}
