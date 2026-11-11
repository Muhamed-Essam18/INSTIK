import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PickUpBanner } from "@/components/library/PickUpBanner";
import { LibraryProgress } from "@/components/screens/LibraryProgress";
import { getVideos } from "@/lib/content";

const mocks = vi.hoisted(() => ({ learner: vi.fn(), profile: vi.fn(), progress: vi.fn() }));
vi.mock("@/lib/session", () => ({ getLearner: mocks.learner }));
vi.mock("@/lib/learner/profiles", () => ({ getProfile: mocks.profile }));
vi.mock("@/lib/hours/queries", () => ({ getLibraryProgress: mocks.progress }));
// A learner with Full access, so these tests keep checking progress only (locked markers have their own tests).
vi.mock("@/lib/billing/subscription", () => ({
  getSubscription: async () => ({
    status: "ACTIVE",
    plan: "MONTHLY",
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: "sub_1",
  }),
}));

const slug = "arabic-egyptian";
const videos = getVideos(slug);
const first = videos[0];
// The Library opens on the Follow it stage, so the watched video must be one of those.
const second = videos.find((v) => v.stage === "follow-it")!;

beforeEach(() => {
  mocks.learner.mockReset().mockResolvedValue({ id: "u1", email: "a@example.com", name: null, image: null });
  mocks.profile.mockReset().mockResolvedValue({ languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 20 });
  mocks.progress.mockReset().mockResolvedValue({ pickUp: null, watchedSlugs: [] });
});
afterEach(cleanup);

const renderProgress = async () => render(await LibraryProgress({ languageSlug: slug }));

describe("Library banner and Watched labels", () => {
  it("shows the unfinished video with its time and host, linked with the start position", async () => {
    mocks.progress.mockResolvedValue({ pickUp: { videoSlug: first.slug, positionSeconds: 134 }, watchedSlugs: [] });
    await renderProgress();
    const link = screen.getByRole("link", { name: new RegExp(first.title) });
    expect(link.getAttribute("href")).toBe(`/learn/${slug}/watch/${first.slug}?t=134`);
    expect(screen.getByText("Pick up where you left off")).toBeTruthy();
    expect(screen.getByText(/2:14 of/)).toBeTruthy();
    expect(screen.getByText("Keep watching")).toBeTruthy();
  });

  it("hides the banner when there is nothing to pick up", async () => {
    await renderProgress();
    expect(screen.queryByText("Pick up where you left off")).toBeNull();
  });

  it("shows Watched only on watched cards", async () => {
    mocks.progress.mockResolvedValue({ pickUp: null, watchedSlugs: [second.slug] });
    await renderProgress();
    expect(screen.getAllByText("Watched")).toHaveLength(1);
    const card = screen.getAllByRole("link").find((a) => a.getAttribute("href") === `/learn/${slug}/watch/${second.slug}`);
    expect(card?.textContent).toContain("Watched");
  });

  it("uses only the current language's progress (asks for that language's code)", async () => {
    await renderProgress();
    expect(mocks.progress).toHaveBeenCalledWith("u1", "arz", expect.any(Function));
  });

  it("shows neither for a signed-out visitor, without reading progress", async () => {
    mocks.learner.mockResolvedValue(null);
    await renderProgress();
    expect(screen.queryByText("Pick up where you left off")).toBeNull();
    expect(screen.queryByText("Watched")).toBeNull();
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("shows neither for a learner without a profile in this language", async () => {
    mocks.profile.mockResolvedValue(undefined);
    await renderProgress();
    expect(mocks.progress).not.toHaveBeenCalled();
    expect(screen.queryByText("Pick up where you left off")).toBeNull();
  });

  it("the banner itself renders nothing without a pick-up", () => {
    const { container } = render(<PickUpBanner languageSlug={slug} pickUp={null} />);
    expect(container.textContent).toBe("");
  });

  it("the banner ignores a video that no longer exists", () => {
    const { container } = render(<PickUpBanner languageSlug={slug} pickUp={{ videoSlug: "gone", positionSeconds: 5 }} />);
    expect(container.textContent).toBe("");
  });
});
