import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatorNav, CreatorNavFallback } from "@/components/creator/CreatorNav";

const pathname = vi.hoisted(() => ({ value: "/creator" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

function current(path: string): string[] {
  pathname.value = path;
  render(<CreatorNav signedInAs="Salma" />);
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent ?? "");
}

describe("CreatorNav", () => {
  it("has the four panel links to the right pages and says who is signed in", () => {
    pathname.value = "/creator";
    render(<CreatorNav signedInAs="Salma" />);
    expect(screen.getByRole("navigation", { name: "Creator panel" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/creator");
    expect(screen.getByRole("link", { name: "Upload a video" }).getAttribute("href")).toBe("/creator/upload");
    expect(screen.getByRole("link", { name: "My videos" }).getAttribute("href")).toBe("/creator/videos");
    expect(screen.getByRole("link", { name: "My host page" }).getAttribute("href")).toBe("/creator/host");
    expect(screen.getByText("Signed in as Salma")).toBeTruthy();
  });

  it("marks exactly the current page", () => {
    expect(current("/creator")).toEqual(["Dashboard"]);
    cleanup();
    expect(current("/creator/upload")).toEqual(["Upload a video"]);
    cleanup();
    expect(current("/creator/videos")).toEqual(["My videos"]);
    cleanup();
    expect(current("/creator/host")).toEqual(["My host page"]);
  });

  it("marks My videos on a video's status page and its edit page, and Dashboard only on the home page", () => {
    expect(current("/creator/videos/abc")).toEqual(["My videos"]);
    cleanup();
    expect(current("/creator/videos/abc/edit")).toEqual(["My videos"]);
  });

  it("marks nothing in the fallback shown before the path is known", () => {
    render(<CreatorNavFallback />);
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page")).toEqual([]);
    expect(screen.queryByText(/Signed in as/)).toBeNull();
  });
});
