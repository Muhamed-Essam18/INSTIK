import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ComingSoonNotice } from "@/components/ComingSoonNotice";
import { getLanguageBySlug, isAvailable, languages } from "@/lib/languages";

export function generateStaticParams() {
  return languages.map((language) => ({ language: language.slug }));
}

export default async function LanguageLayout({
  params,
  children,
}: {
  params: Promise<{ language: string }>;
  children: ReactNode;
}) {
  const { language: slug } = await params;
  const language = getLanguageBySlug(slug);
  if (!language) notFound();
  if (!isAvailable(language)) return <ComingSoonNotice language={language} />;
  return children;
}
