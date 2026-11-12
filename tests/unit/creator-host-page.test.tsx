import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentDb } from "../helpers/content-db";

// A creator's profile is their public host page: it opens with no videos yet, shows a calm story placeholder,
// lists only Approved videos and still ends (spec Story 3 scenario 6, FR-011).

vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../helpers/content-db");
  return { db: () => contentDb.db };
});
vi.mock("@/lib/session", () => ({ getLearner: async () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

import { HostScreen } from "@/components/screens/HostScreen";

const slug = "arabic-egyptian";
const code = "arz";
const renderHost = async (host: string) => render(await HostScreen({ params: Promise.resolve({ language: slug, host }) }));

beforeEach(() => contentDb.reset());
afterEach(cleanup);

describe("a creator's host page", () => {
  it("opens with no videos, with the placeholder story and an empty list that still ends", async () => {
    contentDb.addHost({ languageCode: code, slug: "new-creator", name: "New Creator" });
    await renderHost("new-creator");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("New Creator");
    expect(screen.getByText("Their story is coming soon.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Videos with New Creator" })).toBeTruthy();
    expect(screen.getByText("New Creator's first videos are on the way.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /say hello/ })).toBeNull();
  });

  it("lists only the creator's Approved videos", async () => {
    const host = contentDb.addHost({ languageCode: code, slug: "mixed", name: "Mixed" });
    contentDb.addVideo({ languageCode: code, slug: "live-one", title: "Live one", hostId: host.id, status: "APPROVED" });
    contentDb.addVideo({ languageCode: code, slug: "draft-one", title: "Draft one", hostId: host.id, status: "DRAFT" });
    contentDb.addVideo({ languageCode: code, slug: "review-one", title: "Review one", hostId: host.id, status: "IN_REVIEW" });
    await renderHost("mixed");
    expect(screen.getByText("Live one")).toBeTruthy();
    expect(screen.queryByText("Draft one")).toBeNull();
    expect(screen.queryByText("Review one")).toBeNull();
  });

  it("is not found for an address that is no host", async () => {
    await expect(renderHost("nobody")).rejects.toThrow("notFound");
  });

  it("keeps imported hosts exactly as before", async () => {
    await renderHost("salma");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Salma");
    expect(screen.queryByText("Their story is coming soon.")).toBeNull();
  });
});
