export type Screen = {
  name: string;
  scope: "independent" | "language";
  path: string;
};

export const landingPath = () => "/";
const withReturnTo = (path: string, returnTo?: string) =>
  returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;

export const onboardingPath = (returnTo?: string) => withReturnTo("/onboarding", returnTo);
export const onboardingFinishPath = (returnTo?: string) => withReturnTo("/onboarding/finish", returnTo);
export const signInPath = (returnTo?: string) => withReturnTo("/sign-in", returnTo);
export const settingsPath = () => "/settings";
export const addLanguagePath = (code?: string, returnTo?: string) => {
  const params = new URLSearchParams();
  if (code) params.set("language", code);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `/settings/add-language?${query}` : "/settings/add-language";
};
export const pricingPath = () => "/pricing";
export type BillingPeriod = "monthly" | "yearly";
export const billingStartPath = (period: BillingPeriod) => `/billing/start?period=${period}`;
export const billingPortalPath = (flow?: "cancel") => (flow ? `/billing/portal?flow=${flow}` : "/billing/portal");
export const billingReturnPath = () => "/billing/return";
/** How long a creator invitation link works, in days. */
export const INVITE_LIFETIME_DAYS = 7;
export const invitePath = (token: string) => `/invite/${token}`;
export const creatorPath = () => "/creator";
export const ownerPath = () => "/owner";
export const creatorUploadPath = () => "/creator/upload";
export type CreatorVideoFilter = "in-review" | "changes" | "live" | "drafts";
export const creatorVideosPath = (filter?: CreatorVideoFilter) => (filter ? `/creator/videos?status=${filter}` : "/creator/videos");
export const creatorVideoPath = (id: string) => `/creator/videos/${id}`;
export const creatorVideoEditPath = (id: string) => `/creator/videos/${id}/edit`;
export const creatorHostPath = () => "/creator/host";
export const muxWebhookPath = () => "/api/mux/webhook";
export const ownerCreatorsPath = () => "/owner/creators";
export const aboutPath = () => "/about";
export const privacyPath = () => "/privacy";
export const howItWorksPath = () => "/#how-it-works";
/** The waitlist on the landing page, with a language preselected when `code` is given. */
export const waitlistPath = (code?: string) => (code ? `/?language=${encodeURIComponent(code)}#waitlist` : "/#waitlist");
export const libraryPath = (slug: string) => `/learn/${slug}`;
export const watchPath = (slug: string) => `/learn/${slug}/watch`;
export const watchVideoPath = (slug: string, video: string) => `/learn/${slug}/watch/${video}`;
export const donePath = (slug: string) => `/learn/${slug}/done`;
export const roadmapPath = (slug: string) => `/learn/${slug}/roadmap`;
export const hostsPath = (slug: string) => `/learn/${slug}/hosts`;
export const hostPath = (slug: string, host: string) => `/learn/${slug}/hosts/${host}`;

export const screens: readonly Screen[] = [
  { name: "Landing", scope: "independent", path: "/" },
  { name: "Onboarding", scope: "independent", path: "/onboarding" },
  { name: "Pricing", scope: "independent", path: "/pricing" },
  { name: "About", scope: "independent", path: "/about" },
  { name: "Privacy", scope: "independent", path: "/privacy" },
  { name: "Library", scope: "language", path: "/learn/[language]" },
  { name: "Player", scope: "language", path: "/learn/[language]/watch" },
  { name: "Done for today", scope: "language", path: "/learn/[language]/done" },
  { name: "Roadmap", scope: "language", path: "/learn/[language]/roadmap" },
  { name: "Host", scope: "language", path: "/learn/[language]/hosts" },
  { name: "Sign in", scope: "independent", path: "/sign-in" },
  { name: "Settings", scope: "independent", path: "/settings" },
  { name: "Add a language", scope: "independent", path: "/settings/add-language" },
];

/** The slug for `/learn/<slug>` and `/learn/<slug>/...`, otherwise undefined. */
export function languageSlugFromPathname(pathname: string): string | undefined {
  const [, first, slug] = pathname.split("/");
  return first === "learn" && slug ? slug : undefined;
}
