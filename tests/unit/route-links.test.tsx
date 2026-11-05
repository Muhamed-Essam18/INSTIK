import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { languages } from "@/lib/languages";

import Landing from "@/app/(shell)/page";
import Onboarding from "@/app/(shell)/onboarding/page";
import Pricing from "@/app/(shell)/pricing/page";
import Library from "@/app/(shell)/learn/[language]/page";
import Watch from "@/app/(shell)/learn/[language]/watch/page";
import Done from "@/app/(shell)/learn/[language]/done/page";
import Roadmap from "@/app/(shell)/learn/[language]/roadmap/page";
import Hosts from "@/app/(shell)/learn/[language]/hosts/page";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

const slug = "arabic-egyptian";
const pages: Record<string, () => ReactElement> = {
  "/": Landing,
  "/onboarding": Onboarding,
  "/pricing": Pricing,
  [`/learn/${slug}`]: Library,
  [`/learn/${slug}/watch`]: Watch,
  [`/learn/${slug}/done`]: Done,
  [`/learn/${slug}/roadmap`]: Roadmap,
  [`/learn/${slug}/hosts`]: Hosts,
};

function hrefsOn(path: string): string[] {
  pathname.value = path;
  const Page = pages[path];
  const { container } = render(
    <ShellFrame>
      <Page />
    </ShellFrame>,
  );
  const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
  cleanup();
  return hrefs.filter((h) => h.startsWith("/"));
}

describe("route links (SC-001)", () => {
  const graph = new Map(Object.keys(pages).map((p) => [p, hrefsOn(p)]));

  it("only links to known routes", () => {
    expect(languages.some((l) => l.slug === slug)).toBe(true);
    for (const hrefs of graph.values()) {
      for (const href of hrefs) expect(Object.keys(pages)).toContain(href);
    }
  });

  it("reaches all eight screens from / by following links", () => {
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
