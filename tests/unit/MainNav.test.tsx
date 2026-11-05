import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainNav } from "@/components/shell/MainNav";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

function currentItems(path: string): string[] {
  pathname.value = path;
  render(<MainNav defaultSlug="arabic-egyptian" />);
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent ?? "");
}

describe("MainNav", () => {
  it("links to the default language outside language paths", () => {
    pathname.value = "/";
    render(<MainNav defaultSlug="arabic-egyptian" />);
    expect(screen.getByRole("link", { name: "Library" }).getAttribute("href")).toBe("/learn/arabic-egyptian");
    expect(screen.getByRole("link", { name: "Roadmap" }).getAttribute("href")).toBe("/learn/arabic-egyptian/roadmap");
    expect(screen.getByRole("link", { name: "Hosts" }).getAttribute("href")).toBe("/learn/arabic-egyptian/hosts");
  });

  it("marks exactly the matching section", () => {
    expect(currentItems("/learn/arabic-egyptian")).toEqual(["Library"]);
    cleanup();
    expect(currentItems("/learn/arabic-egyptian/roadmap")).toEqual(["Roadmap"]);
    cleanup();
    expect(currentItems("/learn/arabic-egyptian/hosts")).toEqual(["Hosts"]);
  });

  it("marks nothing on watch, done and language-independent paths", () => {
    for (const path of ["/learn/arabic-egyptian/watch", "/learn/arabic-egyptian/done", "/pricing", "/"]) {
      expect(currentItems(path)).toEqual([]);
      cleanup();
    }
  });
});
