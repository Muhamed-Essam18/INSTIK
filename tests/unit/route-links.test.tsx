import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { getHosts, getVideos } from "@/lib/content";
import { languages } from "@/lib/languages";

import Landing from "@/app/(marketing)/page";
import About from "@/app/(marketing)/about/page";
import Pricing from "@/app/(marketing)/pricing/page";
import Privacy from "@/app/(marketing)/privacy/page";
import { MarketingFrame } from "@/components/marketing/MarketingFrame";
import { LibraryScreen } from "@/components/screens/LibraryScreen";
import { WatchScreen } from "@/components/screens/WatchScreen";
import { DoneScreen } from "@/components/screens/DoneScreen";
import { RoadmapScreen } from "@/components/screens/RoadmapScreen";
import { HostScreen } from "@/components/screens/HostScreen";

const pathname = vi.hoisted(() => ({ value: "/" }));
// These pages need an account; here the learner is signed in with a profile.
vi.mock("@/lib/session", () => ({
  // Signed out for the header's hours pill and the Library's own progress; the protected pages below use requireProfile.
  getLearner: async () => null,
  requireLearner: async () => ({ id: "u1", email: "a@example.com", name: null, image: null }),
  requireProfile: async (code: string) => ({
    learner: { id: "u1", email: "a@example.com", name: null, image: null },
    profile: { languageCode: code, stage: "HEAR_IT", minutesPerDay: 20 },
  }),
}));
// The Roadmap and Done pages read hours from the database; here they get a small, plausible view.
vi.mock("@/lib/hours/queries", () => {
  const rhythm = { weeks: Array.from({ length: 8 }, (_, w) => Array.from({ length: 7 }, (_, d) => ({ day: `2026-01-${String(w * 7 + d + 1).padStart(2, "0")}`, state: "rest", today: false }))), watchedDays: 0 };
  return {
    getHoursByLanguage: async () => ({}),
    getRoadmapView: async () => ({
      today: "2026-11-08",
      timeZone: "UTC",
      watchedSeconds: 3600,
      addedMinutes: 0,
      totalSeconds: 3600,
      todaySeconds: 0,
      videosToday: 0,
      languageName: "Egyptian Arabic",
      stage: "HEAR_IT",
      states: [
        { stage: "HEAR_IT", state: "here" },
        { stage: "FOLLOW_IT", state: "next" },
        { stage: "UNDERSTAND_IT", state: "later" },
        { stage: "JOIN_IN", state: "later" },
      ],
      progress: 0.1,
      moreHours: 29,
      nextStage: "FOLLOW_IT",
      hasEstimates: true,
      rhythm,
      entries: [],
      minutesPerDay: 20,
      remindersOn: false,
      hourSound: false,
    }),
    getDoneView: async () => ({
      languageName: "Egyptian Arabic",
      todaySeconds: 1500,
      videosToday: 2,
      totalSeconds: 3600,
      strip: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({ day: `2026-11-0${i + 2}`, label, state: "rest", today: i === 6 })),
    }),
  };
});
vi.mock("@/lib/hours/actions", () => ({ addManualTime: async () => ({ ok: true }), removeManualTime: async () => ({ ok: true }), syncTimeZone: async () => ({ ok: true, changed: false }), recordHeartbeat: async () => ({ ok: false }), endOfVideo: async () => ({ ok: true, showDone: false }) }));
vi.mock("@/lib/hours/settings-actions", () => ({ saveSessionSettings: async () => ({ ok: true }) }));
vi.mock("@/lib/learner/actions", () => ({ updateProfile: async () => ({ ok: true }) }));
vi.mock("@/lib/learner/preferences", () => ({
  getLayers: async () => ({ script: true, tashkeel: true, transliteration: true, english: false }),
  getAnswer: async () => undefined,
}));
vi.mock("@/lib/learner/preference-actions", () => ({ saveLayers: async () => ({ ok: true }), saveAnswer: async () => ({ ok: true }) }));
// The learner here has Full access, so the watch page shows the player (locked states have their own tests).
vi.mock("@/lib/billing/subscription", () => ({
  getSubscription: async () => ({
    status: "ACTIVE",
    plan: "MONTHLY",
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: "sub_1",
  }),
  requireVideoAccess: async () => ({ ok: true }),
}));
// The marketing call to action and log-in link read the session on the server; here they are the signed-out links.
vi.mock("@/components/marketing/StartLink", () => ({
  StartCta: ({ className, children }: { className: string; children: React.ReactNode }) => (
    <a href="/onboarding" className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/marketing/LogInSlot", () => ({ LogInSlot: () => <a href="/sign-in">Log in</a> }));
// The user slot reads the session on the server; here it is the signed-out link the header would show.
vi.mock("@/components/shell/UserSlot", () => ({ UserSlot: () => <a href="/sign-in">Sign in</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value, useRouter: () => ({ push: () => {}, refresh: () => {} }), useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("notFound"); } }));

afterEach(cleanup);

const slug = "arabic-egyptian";
const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

// `/learn/{language}/hosts` redirects to the first host, so it is rendered as that host's page.
const firstHost = getHosts(slug)[0].slug;
const pages: Record<string, () => ReactElement | Promise<ReactElement>> = {
  "/": Landing,
  // Onboarding and sign-in read the session and query string on the server; their links are not needed here.
  "/onboarding": () => <div />,
  "/pricing": Pricing,
  "/about": About,
  "/privacy": Privacy,
  "/sign-in": () => <div />,
  [`/learn/${slug}`]: () => LibraryScreen(params({ language: slug })),
  [`/learn/${slug}/done`]: () => DoneScreen(params({ language: slug })),
  [`/learn/${slug}/roadmap`]: () => RoadmapScreen(params({ language: slug })),
  [`/learn/${slug}/hosts`]: () => HostScreen(params({ language: slug, host: firstHost })),
  ...Object.fromEntries(
    getHosts(slug).map((h) => [
      `/learn/${slug}/hosts/${h.slug}`,
      () => HostScreen(params({ language: slug, host: h.slug })),
    ]),
  ),
  ...Object.fromEntries(
    getVideos(slug).map((v) => [
      `/learn/${slug}/watch/${v.slug}`,
      () => WatchScreen(params({ language: slug, video: v.slug })),
    ]),
  ),
};

const marketingPaths = new Set(["/", "/pricing", "/about", "/privacy"]);

async function hrefsOn(path: string): Promise<string[]> {
  pathname.value = path;
  const page = await pages[path]();
  const Frame = marketingPaths.has(path) ? MarketingFrame : ShellFrame;
  const { container } = render(<Frame>{page}</Frame>);
  // Anchors and query strings point at the same page, so only the path is compared.
  const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!.split(/[?#]/)[0] || "/");
  cleanup();
  return hrefs.filter((h) => h.startsWith("/"));
}

describe("route links (SC-001)", () => {
  const graph = new Map<string, string[]>();

  beforeAll(async () => {
    for (const path of Object.keys(pages)) graph.set(path, await hrefsOn(path));
  });

  it("only links to known routes", () => {
    expect(languages.some((l) => l.slug === slug)).toBe(true);
    for (const hrefs of graph.values()) {
      for (const href of hrefs) expect(Object.keys(pages)).toContain(href);
    }
  });

  it("reaches every screen from / by following links", () => {
    const seen = new Set<string>(["/"]);
    const queue = ["/"];
    while (queue.length) {
      for (const next of graph.get(queue.shift()!) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(pages).sort());
  });
});
