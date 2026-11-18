import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerNav, OwnerNavFallback } from "@/components/owner/OwnerNav";

const pathname = vi.hoisted(() => ({ value: "/owner" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

function current(path: string): string[] {
  pathname.value = path;
  render(<OwnerNav />);
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent ?? "");
}

describe("OwnerNav", () => {
  it("has Review queue, Creators and the learner site, and no Earnings link", () => {
    pathname.value = "/owner";
    render(<OwnerNav />);
    expect(screen.getByRole("navigation", { name: "Owner panel" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review queue" }).getAttribute("href")).toBe("/owner");
    expect(screen.getByRole("link", { name: "Creators" }).getAttribute("href")).toBe("/owner/creators");
    expect(screen.getByRole("link", { name: "Learner site" }).getAttribute("href")).toMatch(/^\/learn\//);
    expect(screen.queryByRole("link", { name: /earnings/i })).toBeNull();
  });

  it("gives every link a 44px target", () => {
    render(<OwnerNav />);
    for (const a of screen.getAllByRole("link")) expect(a.className).toContain("min-h-11");
  });

  it("marks exactly the current page", () => {
    expect(current("/owner")).toEqual(["Review queue"]);
    cleanup();
    expect(current("/owner/review/abc")).toEqual(["Review queue"]);
    cleanup();
    expect(current("/owner/waiting")).toEqual(["Review queue"]);
    cleanup();
    expect(current("/owner/creators")).toEqual(["Creators"]);
    cleanup();
    expect(current("/owner/creators/u1")).toEqual(["Creators"]);
  });

  it("marks nothing in the fallback", () => {
    render(<OwnerNavFallback />);
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page")).toEqual([]);
  });
});
