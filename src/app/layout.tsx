import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Noto_Naskh_Arabic, Nunito } from "next/font/google";
import { siteName, siteUrl, tagline } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({
  variable: "--nf-nunito",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--nf-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--nf-plex-arabic",
  subsets: ["arabic"],
  weight: ["500", "600"],
  display: "swap",
});

const naskh = Noto_Naskh_Arabic({
  variable: "--nf-naskh",
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: `${siteName} — ${tagline}`,
  description: "Watch real native speakers at your level and see every honest hour add up. Now teaching Egyptian Arabic.",
  openGraph: { siteName, type: "website", locale: "en" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${inter.variable} ${plexArabic.variable} ${naskh.variable} antialiased`}
    >
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
