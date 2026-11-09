import type { MetadataRoute } from "next";
import { aboutPath, landingPath, pricingPath, privacyPath } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

/** The marketing pages only. Account, onboarding and learning pages are not promoted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [landingPath(), pricingPath(), aboutPath(), privacyPath()].map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
  }));
}
