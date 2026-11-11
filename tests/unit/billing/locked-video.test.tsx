import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LockedVideo } from "@/components/billing/LockedVideo";
import { getHosts } from "@/lib/content";

afterEach(cleanup);

const host = getHosts("arabic-egyptian")[0];
const renderLocked = () =>
  render(
    <LockedVideo
      languageSlug="arabic-egyptian"
      title="A day at a wedding"
      meta="Follow it · 8:40 · Egyptian Arabic"
      host={host}
      firstHost
    />,
  );

describe("LockedVideo", () => {
  it("shows the title, the host and the kind sentence", () => {
    renderLocked();
    expect(screen.getByRole("heading", { level: 1, name: "A day at a wedding" })).toBeTruthy();
    expect(screen.getByText("Follow it · 8:40 · Egyptian Arabic")).toBeTruthy();
    expect(screen.getByText(host.name)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "This one is part of Full access." })).toBeTruthy();
    expect(screen.getByText("Free videos are still here for you, and your hours stay exactly as they are.")).toBeTruthy();
  });

  it("links to pricing and back to the library", () => {
    renderLocked();
    expect(screen.getByRole("link", { name: "See Full access" }).getAttribute("href")).toBe("/pricing");
    expect(screen.getByRole("link", { name: "Back to the library" }).getAttribute("href")).toBe("/learn/arabic-egyptian");
  });

  it("is an ordinary part of the page: no dialog, no modal, no countdown or urgency", () => {
    const { container } = renderLocked();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(container.querySelector("[aria-modal]")).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/limited|hurry|last chance|expires|only \d|countdown|don.t miss/i);
  });

  it("names the reason for assistive technology through its region heading", () => {
    renderLocked();
    const region = screen.getByRole("region", { name: "This one is part of Full access." });
    expect(region).toBeTruthy();
  });

  it("has no video, no player controls and no transcript", () => {
    const { container } = renderLocked();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByText(/transcript/i)).toBeNull();
  });
});
