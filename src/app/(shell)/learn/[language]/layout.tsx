import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ComingSoonNotice } from "@/components/ComingSoonNotice";
import { PageFallback } from "@/components/screens/PageFallback";
import { getLanguageBySlug, isAvailable, languages } from "@/lib/languages";

export function generateStaticParams() {
  return languages.map((language) => ({ language: language.slug }));
}

async function LanguageGate({ params, children }: { params: Promise<{ language: string }>; children: ReactNode }) {
  const { language: slug } = await params;
  const language = getLanguageBySlug(slug);
  if (!language) notFound();
  if (!isAvailable(language)) return <ComingSoonNotice language={language} />;
  return children;
}

export default function LanguageLayout({
  params,
  children,
}: {
  params: Promise<{ language: string }>;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LanguageGate params={params}>{children}</LanguageGate>
    </Suspense>
  );
}
