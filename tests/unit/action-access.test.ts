import { beforeEach, describe, expect, it, vi } from "vitest";

// Access rules for every server action, with the session and the database mocked (constitution IX, FR-040, SC-010):
// a signed-out call is refused, another user's id in the input changes nothing, and invalid input writes nothing.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    learnerLanguage: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    preference: { findUnique: vi.fn(), upsert: vi.fn() },
    comprehensionAnswer: { findMany: vi.fn(), upsert: vi.fn() },
    signInAttempt: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  },
  signIn: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: mocks.signIn, signOut: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => mocks.db }));
vi.mock("@/lib/env", () => ({ env: () => ({ IP_HASH_SALT: "s".repeat(16) }) }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { requestEmailLink } from "@/lib/auth/actions";
import { addLanguage, completeOnboarding, updateProfile } from "@/lib/learner/actions";

const userA = { user: { id: "user-a", email: "a@example.com", name: "A", image: null } };
const valid = { languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 20 };

function writes() {
  const { learnerLanguage, preference, comprehensionAnswer, signInAttempt } = mocks.db;
  return [
    learnerLanguage.create,
    learnerLanguage.updateMany,
    preference.upsert,
    comprehensionAnswer.upsert,
    signInAttempt.createMany,
  ];
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue(userA);
  mocks.signIn.mockReset().mockResolvedValue(undefined);
  mocks.headers.mockReset().mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.5" }));
  for (const table of Object.values(mocks.db)) for (const fn of Object.values(table)) fn.mockReset();
  mocks.db.learnerLanguage.findMany.mockResolvedValue([]);
  mocks.db.learnerLanguage.create.mockResolvedValue({});
  mocks.db.learnerLanguage.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.signInAttempt.findMany.mockResolvedValue([]);
  mocks.db.signInAttempt.count.mockResolvedValue(0);
  mocks.db.signInAttempt.createMany.mockResolvedValue({ count: 2 });
  mocks.db.signInAttempt.deleteMany.mockResolvedValue({ count: 0 });
});

describe("signed-out calls are refused", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue(null);
  });

  it.each([
    ["completeOnboarding", () => completeOnboarding(valid)],
    ["addLanguage", () => addLanguage(valid)],
    ["updateProfile", () => updateProfile({ languageCode: "arz", minutesPerDay: 30 })],
  ])("%s redirects and writes nothing", async (_name, call) => {
    await expect(call()).rejects.toThrow(/^REDIRECT:/);
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });
});

describe("the learner always comes from the session", () => {
  it("completeOnboarding creates the profile for the session's user even if the input names another", async () => {
    await expect(completeOnboarding({ ...valid, userId: "user-b" })).resolves.toEqual({ ok: true });
    expect(mocks.db.learnerLanguage.create).toHaveBeenCalledWith({ data: { userId: "user-a", ...valid } });
    expect(mocks.db.learnerLanguage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } }),
    );
  });

  it("addLanguage ignores a userId in the input", async () => {
    mocks.db.learnerLanguage.findMany.mockResolvedValue([]);
    await addLanguage({ ...valid, userId: "user-b" });
    expect(mocks.db.learnerLanguage.create).toHaveBeenCalledWith({ data: { userId: "user-a", ...valid } });
  });

  it("updateProfile only ever filters by the session's user", async () => {
    await expect(updateProfile({ languageCode: "arz", minutesPerDay: 60, userId: "user-b" })).resolves.toEqual({ ok: true });
    expect(mocks.db.learnerLanguage.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-a", languageCode: "arz" },
      data: { minutesPerDay: 60 },
    });
  });

  it("updateProfile reports not-found when the learner has no profile for that language", async () => {
    mocks.db.learnerLanguage.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateProfile({ languageCode: "arz", stage: "JOIN_IN" })).resolves.toEqual({
      ok: false,
      code: "not-found",
    });
  });
});

describe("profile rules are enforced on the server", () => {
  it("refuses a language that is not available", async () => {
    await expect(addLanguage({ ...valid, languageCode: "es" })).resolves.toEqual({
      ok: false,
      code: "unavailable-language",
    });
    await expect(completeOnboarding({ ...valid, languageCode: "xx" })).resolves.toEqual({
      ok: false,
      code: "unavailable-language",
    });
    expect(mocks.db.learnerLanguage.create).not.toHaveBeenCalled();
  });

  it("refuses to add a language twice", async () => {
    mocks.db.learnerLanguage.findMany.mockResolvedValue([{ ...valid }]);
    await expect(addLanguage(valid)).resolves.toEqual({ ok: false, code: "exists" });
    expect(mocks.db.learnerLanguage.create).not.toHaveBeenCalled();
  });

  it("completeOnboarding keeps an existing profile unless asked, and replaces it only for the session's user", async () => {
    mocks.db.learnerLanguage.findMany.mockResolvedValue([{ ...valid, minutesPerDay: 10 }]);
    await expect(completeOnboarding({ ...valid, minutesPerDay: 60 })).resolves.toEqual({ ok: false, code: "exists" });
    expect(mocks.db.learnerLanguage.updateMany).not.toHaveBeenCalled();
    await expect(completeOnboarding({ ...valid, minutesPerDay: 60, replaceExisting: true })).resolves.toEqual({ ok: true });
    expect(mocks.db.learnerLanguage.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-a", languageCode: "arz" },
      data: { stage: "HEAR_IT", minutesPerDay: 60 },
    });
  });

  it("turns a database unique-key violation into exists", async () => {
    mocks.db.learnerLanguage.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(addLanguage(valid)).resolves.toEqual({ ok: false, code: "exists" });
  });

  it.each([
    ["minutes 15", { ...valid, minutesPerDay: 15 }],
    ["an unknown stage", { ...valid, stage: "BEGINNER" }],
    ["no language", { stage: "HEAR_IT", minutesPerDay: 20 }],
    ["text minutes", { ...valid, minutesPerDay: "20" }],
  ])("refuses %s and writes nothing", async (_name, input) => {
    await expect(completeOnboarding(input)).resolves.toEqual({ ok: false, code: "invalid" });
    await expect(addLanguage(input)).resolves.toEqual({ ok: false, code: "invalid" });
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });

  it("updateProfile refuses an empty change and a bad value", async () => {
    await expect(updateProfile({ languageCode: "arz" })).resolves.toEqual({ ok: false, code: "invalid" });
    await expect(updateProfile({ languageCode: "arz", minutesPerDay: 45 })).resolves.toEqual({ ok: false, code: "invalid" });
    await expect(updateProfile({ languageCode: "arz", stage: "EXPERT" })).resolves.toEqual({ ok: false, code: "invalid" });
    expect(mocks.db.learnerLanguage.updateMany).not.toHaveBeenCalled();
  });
});

describe("requestEmailLink", () => {
  it("refuses an invalid address and sends nothing", async () => {
    await expect(requestEmailLink({ email: "nope" })).resolves.toEqual({ ok: false, code: "invalid-email" });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("sends a link for a valid address, recording the attempt", async () => {
    await expect(requestEmailLink({ email: " Amal@Example.com ", returnTo: "/settings" })).resolves.toEqual({ ok: true });
    expect(mocks.signIn).toHaveBeenCalledWith("resend", {
      email: "amal@example.com",
      redirect: false,
      redirectTo: "/onboarding/finish?returnTo=%2Fsettings",
    });
    expect(mocks.db.signInAttempt.createMany).toHaveBeenCalled();
  });

  it("refuses the sixth link to one address within an hour and sends no email", async () => {
    mocks.db.signInAttempt.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ createdAt: new Date(Date.now() - (i + 1) * 5 * 60 * 1000) })),
    );
    await expect(requestEmailLink({ email: "amal@example.com" })).resolves.toEqual({ ok: false, code: "too-many" });
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.db.signInAttempt.createMany).not.toHaveBeenCalled();
  });

  it("refuses a second link within 30 seconds", async () => {
    mocks.db.signInAttempt.findMany.mockResolvedValue([{ createdAt: new Date(Date.now() - 5_000) }]);
    await expect(requestEmailLink({ email: "amal@example.com" })).resolves.toEqual({ ok: false, code: "too-many" });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("falls back to a safe return address", async () => {
    await requestEmailLink({ email: "amal@example.com", returnTo: "https://evil.example" });
    expect(mocks.signIn).toHaveBeenCalledWith("resend", {
      email: "amal@example.com",
      redirect: false,
      redirectTo: "/onboarding/finish?returnTo=%2Flearn%2Farabic-egyptian",
    });
  });

  it("reports a failed send without saying anything about the account", async () => {
    mocks.signIn.mockRejectedValue(new Error("resend down"));
    await expect(requestEmailLink({ email: "amal@example.com" })).resolves.toEqual({ ok: false, code: "failed" });
  });
});

// ---- transcript choices and answers ------------------------------------------------------------------------------

import { importDevicePreferences, saveAnswer, saveLayers } from "@/lib/learner/preference-actions";

describe("preference actions", () => {
  const profile = { id: "profile-a", userId: "user-a", languageCode: "arz", stage: "HEAR_IT", minutesPerDay: 20 };

  beforeEach(() => {
    mocks.db.learnerLanguage.findUnique.mockResolvedValue(profile);
    mocks.db.preference.upsert.mockResolvedValue({});
    mocks.db.comprehensionAnswer.upsert.mockResolvedValue({});
    mocks.db.comprehensionAnswer.findMany.mockResolvedValue([]);
  });

  describe("signed out", () => {
    beforeEach(() => {
      mocks.auth.mockResolvedValue(null);
    });

    it.each([
      ["saveLayers", () => saveLayers({ languageCode: "arz", layers: { english: true } })],
      ["saveAnswer", () => saveAnswer({ languageCode: "arz", videoSlug: "at-the-cafe", answer: "mostly" })],
      ["importDevicePreferences", () => importDevicePreferences({ layers: { arz: { english: true } }, answers: {} })],
    ])("%s is refused and writes nothing", async (_name, call) => {
      await expect(call()).rejects.toThrow(/^REDIRECT:/);
      for (const write of writes()) expect(write).not.toHaveBeenCalled();
    });
  });

  describe("saveLayers", () => {
    it("saves for the session's user and profile, ignoring a userId in the input", async () => {
      await expect(saveLayers({ languageCode: "arz", layers: { english: true }, userId: "user-b" })).resolves.toEqual({ ok: true });
      expect(mocks.db.learnerLanguage.findUnique).toHaveBeenCalledWith({
        where: { userId_languageCode: { userId: "user-a", languageCode: "arz" } },
      });
      expect(mocks.db.preference.upsert).toHaveBeenCalledWith({
        where: { learnerLanguageId: "profile-a" },
        create: { learnerLanguageId: "profile-a", layers: { english: true } },
        update: { layers: { english: true } },
      });
    });

    it("needs a profile for the language", async () => {
      mocks.db.learnerLanguage.findUnique.mockResolvedValue(null);
      await expect(saveLayers({ languageCode: "arz", layers: { english: true } })).resolves.toEqual({
        ok: false,
        code: "no-profile",
      });
      expect(mocks.db.preference.upsert).not.toHaveBeenCalled();
    });

    it.each([
      ["a layer the language does not use", { languageCode: "es", layers: { tashkeel: true } }],
      ["an unknown layer", { languageCode: "arz", layers: { sparkle: true } }],
      ["a value that is not true or false", { languageCode: "arz", layers: { english: "yes" } }],
      ["an unknown language", { languageCode: "zz", layers: { english: true } }],
    ])("refuses %s", async (_name, input) => {
      await expect(saveLayers(input)).resolves.toMatchObject({ ok: false });
      expect(mocks.db.preference.upsert).not.toHaveBeenCalled();
    });
  });

  describe("saveAnswer", () => {
    it("saves one answer for the session's user, replacing the old one", async () => {
      await expect(
        saveAnswer({ languageCode: "arz", videoSlug: "at-the-cafe", answer: "not-yet", userId: "user-b" }),
      ).resolves.toEqual({ ok: true });
      expect(mocks.db.comprehensionAnswer.upsert).toHaveBeenCalledWith({
        where: { userId_languageCode_videoSlug: { userId: "user-a", languageCode: "arz", videoSlug: "at-the-cafe" } },
        create: { userId: "user-a", languageCode: "arz", videoSlug: "at-the-cafe", answer: "NOT_YET" },
        update: { answer: "NOT_YET" },
      });
    });

    it("refuses a video that does not exist, an unknown answer and a language without a profile", async () => {
      await expect(saveAnswer({ languageCode: "arz", videoSlug: "nope", answer: "mostly" })).resolves.toEqual({
        ok: false,
        code: "unknown-video",
      });
      await expect(
        saveAnswer({ languageCode: "arz", videoSlug: "at-the-cafe", answer: "perfect" }),
      ).resolves.toEqual({ ok: false, code: "invalid" });
      mocks.db.learnerLanguage.findUnique.mockResolvedValue(null);
      await expect(saveAnswer({ languageCode: "arz", videoSlug: "at-the-cafe", answer: "mostly" })).resolves.toEqual({
        ok: false,
        code: "no-profile",
      });
      expect(mocks.db.comprehensionAnswer.upsert).not.toHaveBeenCalled();
    });
  });

  describe("importDevicePreferences", () => {
    beforeEach(() => {
      mocks.db.learnerLanguage.findMany.mockResolvedValue([{ ...profile, preference: null }]);
    });

    it("imports into the session's account, only where the account has nothing", async () => {
      mocks.db.comprehensionAnswer.findMany.mockResolvedValue([{ languageCode: "arz", videoSlug: "at-the-cafe" }]);
      const result = await importDevicePreferences({
        layers: { arz: { english: true } },
        answers: { arz: { "at-the-cafe": "not-yet", "my-family": "some" } },
      });
      expect(result).toMatchObject({ ok: true, imported: { layers: 1, answers: 1 } });
      // The answer the account already had is untouched; only the missing one is written.
      expect(mocks.db.comprehensionAnswer.upsert).toHaveBeenCalledTimes(1);
      expect(mocks.db.comprehensionAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_languageCode_videoSlug: { userId: "user-a", languageCode: "arz", videoSlug: "my-family" } },
        }),
      );
    });

    it("keeps device choices for a language with no profile and never writes them", async () => {
      mocks.db.learnerLanguage.findMany.mockResolvedValue([]);
      const result = await importDevicePreferences({ layers: { arz: { english: true } }, answers: {} });
      expect(result).toMatchObject({ ok: true, remove: { layers: [] } });
      expect(mocks.db.preference.upsert).not.toHaveBeenCalled();
    });

    it("is safe to run twice", async () => {
      const input = { layers: { arz: { english: true } }, answers: { arz: { "my-family": "some" } } };
      await importDevicePreferences(input);
      mocks.db.learnerLanguage.findMany.mockResolvedValue([{ ...profile, preference: { layers: { english: true } } }]);
      mocks.db.comprehensionAnswer.findMany.mockResolvedValue([{ languageCode: "arz", videoSlug: "my-family" }]);
      mocks.db.preference.upsert.mockClear();
      mocks.db.comprehensionAnswer.upsert.mockClear();
      const second = await importDevicePreferences(input);
      expect(second).toMatchObject({ ok: true, imported: { layers: 0, answers: 0 } });
      expect(mocks.db.preference.upsert).not.toHaveBeenCalled();
      expect(mocks.db.comprehensionAnswer.upsert).not.toHaveBeenCalled();
    });

    it("refuses input of the wrong shape or an absurd size", async () => {
      await expect(importDevicePreferences({ layers: "x", answers: {} })).resolves.toEqual({ ok: false, code: "invalid" });
      const many = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`video-${i}`, "some"]));
      await expect(importDevicePreferences({ layers: {}, answers: { arz: many } })).resolves.toEqual({
        ok: false,
        code: "invalid",
      });
      expect(mocks.db.comprehensionAnswer.upsert).not.toHaveBeenCalled();
    });
  });
});
