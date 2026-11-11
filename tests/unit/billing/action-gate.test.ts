import { beforeEach, describe, expect, it, vi } from "vitest";

// The server actions that take a video refuse a full-access video the learner cannot watch, and write nothing.

const mocks = vi.hoisted(() => ({
  isVideoLocked: vi.fn(),
  recordHeartbeat: vi.fn(),
  endOfVideo: vi.fn(),
  saveAnswer: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireLearner: async () => ({ id: "u1", email: "a@example.com", name: null, image: null }) }));
vi.mock("@/lib/billing/subscription", () => ({ isVideoLocked: mocks.isVideoLocked }));
vi.mock("@/lib/hours/service", () => ({
  recordHeartbeat: mocks.recordHeartbeat,
  endOfVideo: mocks.endOfVideo,
  addManualTime: vi.fn(),
}));
vi.mock("@/lib/learner/preferences", () => ({
  saveAnswer: mocks.saveAnswer,
  saveLayers: vi.fn(),
  accountState: vi.fn(),
  applyImport: vi.fn(),
}));

import { endOfVideo, recordHeartbeat } from "@/lib/hours/actions";
import { saveAnswer } from "@/lib/learner/preference-actions";

const heartbeat = {
  languageCode: "arz",
  videoSlug: "a-day-at-a-wedding",
  seconds: 10,
  spanSeconds: 10,
  endedAgoSeconds: 0,
  position: 30,
  duration: 500,
  timeZone: "UTC",
};
const end = { languageCode: "arz", videoSlug: "a-day-at-a-wedding" };
const answer = { languageCode: "arz", videoSlug: "a-day-at-a-wedding", answer: "mostly" };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.recordHeartbeat.mockResolvedValue({ ok: true, accepted: 10, totalSeconds: 10, todaySeconds: 10, stage: "HEAR_IT", chime: false });
  mocks.endOfVideo.mockResolvedValue({ ok: true, showDone: false });
  mocks.saveAnswer.mockResolvedValue("ok");
});

describe("a learner without access to the video", () => {
  beforeEach(() => mocks.isVideoLocked.mockResolvedValue(true));

  it("counts no watching", async () => {
    expect(await recordHeartbeat(heartbeat)).toEqual({ ok: false, code: "rejected" });
    expect(mocks.recordHeartbeat).not.toHaveBeenCalled();
  });

  it("does not run the end-of-video step", async () => {
    expect(await endOfVideo(end)).toEqual({ ok: false, code: "invalid" });
    expect(mocks.endOfVideo).not.toHaveBeenCalled();
  });

  it("stores no answer", async () => {
    expect(await saveAnswer(answer)).toEqual({ ok: false, code: "invalid" });
    expect(mocks.saveAnswer).not.toHaveBeenCalled();
  });

  it("asks about the signed-in learner and the video named in the input", async () => {
    await recordHeartbeat(heartbeat);
    expect(mocks.isVideoLocked).toHaveBeenCalledWith("u1", "arz", "a-day-at-a-wedding");
  });
});

describe("a learner with access", () => {
  beforeEach(() => mocks.isVideoLocked.mockResolvedValue(false));

  it("counts, ends and stores as before", async () => {
    expect((await recordHeartbeat(heartbeat)).ok).toBe(true);
    expect(mocks.recordHeartbeat).toHaveBeenCalledTimes(1);
    expect((await endOfVideo(end)).ok).toBe(true);
    expect(mocks.endOfVideo).toHaveBeenCalledTimes(1);
    expect((await saveAnswer(answer)).ok).toBe(true);
    expect(mocks.saveAnswer).toHaveBeenCalledTimes(1);
  });
});

describe("invalid input", () => {
  it("is refused before access is even asked", async () => {
    expect(await recordHeartbeat({ nope: true })).toEqual({ ok: false, code: "invalid" });
    expect(mocks.isVideoLocked).not.toHaveBeenCalled();
  });
});
