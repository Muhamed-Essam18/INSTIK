export const siteName = "Instik";
export const tagline = "Your scroll time, but it counts.";

/** The public address of the site. Reads the environment directly so `next build` needs no secrets. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
