export type Screen = {
  name: string;
  scope: "independent" | "language";
  path: string;
};

export const landingPath = () => "/";
export const onboardingPath = () => "/onboarding";
export const pricingPath = () => "/pricing";
export const libraryPath = (slug: string) => `/learn/${slug}`;
export const watchPath = (slug: string) => `/learn/${slug}/watch`;
export const donePath = (slug: string) => `/learn/${slug}/done`;
export const roadmapPath = (slug: string) => `/learn/${slug}/roadmap`;
export const hostsPath = (slug: string) => `/learn/${slug}/hosts`;

export const screens: readonly Screen[] = [
  { name: "Landing", scope: "independent", path: "/" },
  { name: "Onboarding", scope: "independent", path: "/onboarding" },
  { name: "Pricing", scope: "independent", path: "/pricing" },
  { name: "Library", scope: "language", path: "/learn/[language]" },
  { name: "Player", scope: "language", path: "/learn/[language]/watch" },
  { name: "Done for today", scope: "language", path: "/learn/[language]/done" },
  { name: "Roadmap", scope: "language", path: "/learn/[language]/roadmap" },
  { name: "Host", scope: "language", path: "/learn/[language]/hosts" },
];

/** The slug for `/learn/<slug>` and `/learn/<slug>/...`, otherwise undefined. */
export function languageSlugFromPathname(pathname: string): string | undefined {
  const [, first, slug] = pathname.split("/");
  return first === "learn" && slug ? slug : undefined;
}
