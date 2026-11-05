import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { getHosts, getVideos } from "@/lib/content";
import { languages } from "@/lib/languages";

import Landing from "@/app/(shell)/page";
import Onboarding from "@/app/(shell)/onboarding/page";
import Pricing from "@/app/(shell)/pricing/page";
import { LibraryScreen } from "@/components/screens/LibraryScreen";
import { WatchScreen } from "@/components/screens/WatchScreen";
import Done from "@/app/(shell)/learn/[language]/done/page";
import Roadmap from "@/app/(shell)/learn/[language]/roadmap/page";
import { HostScreen } from "@/components/screens/HostScreen";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

const slug = "arabic-egyptian";
const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

// `/learn/{language}/hosts` redirects to the first host, so it is rendered as that host's page.
const firstHost = getHosts(slug)[0].slug;
const pages: Record<string, () => ReactElement | Promise<ReactElement>> = {
  "/": Landing,
  "/onboarding": Onboarding,
  "/pricing": Pricing,
  [`/learn/${slug}`]: () => LibraryScreen(params({ language: slug })),
  [`/learn/${slug}/done`]: Done,
  [`/learn/${slug}/roadmap`]: Roadmap,
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

async function hrefsOn(path: string): Promise<string[]> {
  pathname.value = path;
  const page = await pages[path]();
  const { container } = render(<ShellFrame>{page}</ShellFrame>);
  const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
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
