import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: () => ({ learnerLanguage: { findUnique: mocks.findUnique } }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { getLearner, requireLearner, requireProfile } from "@/lib/session";

const signedIn = { user: { id: "user-a", email: "a@example.com", name: "Amal", image: null } };

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.findUnique.mockReset();
});

describe("getLearner", () => {
  it("is null with no session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await getLearner()).toBeNull();
  });

  it("is null for a session without a user id", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "a@example.com" } });
    expect(await getLearner()).toBeNull();
  });

  it("returns the narrow learner for a valid session", async () => {
    mocks.auth.mockResolvedValue(signedIn);
    expect(await getLearner()).toEqual({ id: "user-a", email: "a@example.com", name: "Amal", image: null });
  });
});

describe("requireLearner", () => {
  it("sends a signed-out visitor to sign-in for their own pages, keeping the return address", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireLearner("/learn/arabic-egyptian/roadmap")).rejects.toThrow(
      "REDIRECT:/sign-in?returnTo=%2Flearn%2Farabic-egyptian%2Froadmap",
    );
  });

  it("sends a signed-out visitor to onboarding for a video", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireLearner("/learn/arabic-egyptian/watch/at-the-cafe?t=5")).rejects.toThrow(
      "REDIRECT:/onboarding?returnTo=%2Flearn%2Farabic-egyptian%2Fwatch%2Fat-the-cafe%3Ft%3D5",
    );
  });

  it("returns the learner when signed in", async () => {
    mocks.auth.mockResolvedValue(signedIn);
    expect((await requireLearner("/settings")).id).toBe("user-a");
  });
});

describe("requireProfile", () => {
  it("redirects a signed-out call before touching the database", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireProfile("arz", "/learn/arabic-egyptian/watch/x")).rejects.toThrow(/^REDIRECT:\/onboarding/);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("sends a learner with no profile for the language to add it", async () => {
    mocks.auth.mockResolvedValue(signedIn);
    mocks.findUnique.mockResolvedValue(null);
    await expect(requireProfile("arz", "/learn/arabic-egyptian/watch/x")).rejects.toThrow(
      "REDIRECT:/settings/add-language?language=arz&returnTo=%2Flearn%2Farabic-egyptian%2Fwatch%2Fx",
    );
  });

  it("returns the profile, looked up with the session's user id", async () => {
    mocks.auth.mockResolvedValue(signedIn);
    mocks.findUnique.mockResolvedValue({ languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 20 });
    const { learner, profile } = await requireProfile("arz", "/learn/arabic-egyptian/watch/x");
    expect(learner.id).toBe("user-a");
    expect(profile.languageCode).toBe("arz");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId_languageCode: { userId: "user-a", languageCode: "arz" } },
    });
  });
});
