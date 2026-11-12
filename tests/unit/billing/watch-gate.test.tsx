import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getVideo } from "@/lib/content";

vi.mock("@/lib/db", async () => {
  const { contentDb } = await import("../../helpers/content-db");
  return { db: () => contentDb.db };
});

// The watch page decides access on the server before it reads or sends the playback id, tokens or transcript.

const mocks = vi.hoisted(() => ({
  requireVideoAccess: vi.fn(),
  getSubscription: vi.fn(),
  signPlaybackTokens: vi.fn(),
  getTranscriptView: vi.fn(),
  getLayers: vi.fn(),
  getAnswer: vi.fn(),
  playerProps: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireProfile: async (code: string) => ({
    learner: { id: "u1", email: "a@example.com", name: null, image: null },
    profile: { languageCode: code, stage: "HEAR_IT", minutesPerDay: 20 },
  }),
}));
vi.mock("@/lib/billing/subscription", () => ({
  requireVideoAccess: mocks.requireVideoAccess,
  getSubscription: mocks.getSubscription,
}));
vi.mock("@/lib/billing/playback", () => ({ signPlaybackTokens: mocks.signPlaybackTokens }));
vi.mock("@/lib/learner/preferences", () => ({ getLayers: mocks.getLayers, getAnswer: mocks.getAnswer }));
vi.mock("@/lib/content", async (original) => ({
  ...(await original<typeof import("@/lib/content")>()),
  getTranscriptView: mocks.getTranscriptView,
}));

// The client pieces are stubs: this test is about what the server decides to render and send.
vi.mock("@/components/player/PlaybackProvider", () => ({ PlaybackProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/player/WatchCounter", () => ({ WatchCounter: () => null }));
vi.mock("@/components/player/VideoPlayer", () => ({
  VideoPlayer: (props: Record<string, unknown>) => {
    mocks.playerProps(props);
    return <div data-testid="player" />;
  },
}));
vi.mock("@/components/transcript/TranscriptPanel", () => ({
  TranscriptPanel: () => <div data-testid="transcript">TRANSCRIPT-TEXT</div>,
}));
vi.mock("@/components/watch/UnderstandingCheck", () => ({ UnderstandingCheck: () => null }));
vi.mock("@/components/watch/UpNext", () => ({ UpNext: () => null }));

import { WatchScreen } from "@/components/screens/WatchScreen";

const slug = "arabic-egyptian";
const full = (await getVideo(slug, "a-day-at-a-wedding"))!;
const free = (await getVideo(slug, "at-the-cafe"))!;
const tokens = { playback: "TOKEN-V", thumbnail: "TOKEN-T", storyboard: "TOKEN-S" };
const params = (video: string) => Promise.resolve({ language: slug, video });

const renderWatch = async (video: string) => render(await WatchScreen({ params: params(video) }));

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getLayers.mockResolvedValue({ script: true, tashkeel: true, transliteration: true, english: false });
  mocks.getAnswer.mockResolvedValue(undefined);
  mocks.getSubscription.mockResolvedValue(null);
  mocks.getTranscriptView.mockResolvedValue({ cues: [] });
  mocks.signPlaybackTokens.mockReturnValue(tokens);
});
afterEach(cleanup);

describe("a full-access video without access", () => {
  beforeEach(() => mocks.requireVideoAccess.mockResolvedValue({ ok: false, reason: "locked" }));

  it("shows the calm panel with the title and a link to pricing", async () => {
    const { container, getByText, getByRole } = await renderWatch(full.slug);
    expect(getByText("This one is part of Full access.")).toBeTruthy();
    expect(getByRole("heading", { level: 1 }).textContent).toBe(full.title);
    expect(container.querySelector('a[href="/pricing"]')).toBeTruthy();
  });

  it("sends no playback id, no token and no transcript text", async () => {
    const { container, queryByTestId } = await renderWatch(full.slug);
    expect(queryByTestId("player")).toBeNull();
    expect(queryByTestId("transcript")).toBeNull();
    expect(container.innerHTML).not.toContain(full.playbackId!);
    expect(container.innerHTML).not.toContain("TOKEN-");
    expect(container.innerHTML).not.toContain("TRANSCRIPT-TEXT");
  });

  it("never reads the transcript, the learner's layers or answer, or signs a token", async () => {
    await renderWatch(full.slug);
    expect(mocks.getTranscriptView).not.toHaveBeenCalled();
    expect(mocks.getLayers).not.toHaveBeenCalled();
    expect(mocks.getAnswer).not.toHaveBeenCalled();
    expect(mocks.signPlaybackTokens).not.toHaveBeenCalled();
  });

  it("asks the access rule with the learner and the video", async () => {
    await renderWatch(full.slug);
    expect(mocks.requireVideoAccess).toHaveBeenCalledWith("u1", expect.objectContaining({ slug: full.slug, access: "full" }));
  });
});

describe("a full-access video with access", () => {
  beforeEach(() => mocks.requireVideoAccess.mockResolvedValue({ ok: true }));

  it("renders the player with the signed tokens and the transcript", async () => {
    const { getByTestId } = await renderWatch(full.slug);
    expect(getByTestId("player")).toBeTruthy();
    expect(getByTestId("transcript")).toBeTruthy();
    expect(mocks.playerProps).toHaveBeenCalledWith(expect.objectContaining({ playbackId: full.playbackId, playbackTokens: tokens }));
  });
});

describe("a free video", () => {
  it("renders the player with no token for a learner with no subscription", async () => {
    mocks.requireVideoAccess.mockResolvedValue({ ok: true });
    mocks.signPlaybackTokens.mockReturnValue(null);
    const { getByTestId } = await renderWatch(free.slug);
    expect(getByTestId("player")).toBeTruthy();
    expect(mocks.playerProps).toHaveBeenCalledWith(expect.objectContaining({ playbackTokens: undefined }));
  });
});
