const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
const protectedShapes = [
  new RegExp(`^/learn/${slug}/watch/${slug}$`),
  new RegExp(`^/learn/${slug}/roadmap$`),
  new RegExp(`^/learn/${slug}/done$`),
  /^\/settings(?:\/.*)?$/,
];
const watchShape = new RegExp(`^/learn/${slug}/watch/`);

/** The Auth.js session cookie, plain (http) or secure (https). */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/** Pages that need an account: videos, the learner's own pages and settings. */
export function isProtectedPath(pathname: string): boolean {
  return protectedShapes.some((shape) => shape.test(pathname));
}

/** An optimistic check only: the cookie exists. Whether the session is valid is decided on the server. */
export function hasSessionCookie(cookies: ReadonlyArray<{ name: string; value: string }>): boolean {
  return cookies.some((c) => SESSION_COOKIES.includes(c.name) && c.value !== "");
}

/**
 * Where a signed-out visitor is sent: videos go to onboarding (a new visitor needs the whole path),
 * the learner's own pages go to sign-in. The page they wanted is kept as `returnTo`.
 */
export function gateRedirect(pathname: string, search: string): string {
  const returnTo = encodeURIComponent(`${pathname}${search}`);
  return watchShape.test(pathname) ? `/onboarding?returnTo=${returnTo}` : `/sign-in?returnTo=${returnTo}`;
}
