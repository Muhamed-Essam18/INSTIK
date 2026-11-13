import { beforeEach, describe, expect, it, vi } from "vitest";

// Every creator action runs the real role gate first: a learner, an owner who is not a creator and a signed-out visitor never reach the
// upload service, and an owner who is also a creator does (constitution XI and XIII, spec FR-003 and FR-017).

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  service: {
    createUpload: vi.fn(),
    saveDraft: vi.fn(),
    submitVideo: vi.fn(),
    deleteDraft: vi.fn(),
  },
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: mocks.findUnique } }) }));
vi.mock("@/lib/env", () => ({ env: () => ({ OWNER_EMAILS: "boss@instik.test" }) }));
vi.mock("@/lib/creator/instance", () => ({ uploadService: () => mocks.service }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { createUpload, deleteDraft, saveDraft, submitVideo } from "@/lib/creator/actions";

type Who = "signed-out" | "learner" | "creator" | "owner" | "owner-and-creator";
function as(who: Who) {
  if (who === "signed-out") return mocks.auth.mockResolvedValue(null);
  const email = who.startsWith("owner") ? "boss@instik.test" : `${who}@x.com`;
  mocks.auth.mockResolvedValue({ user: { id: "u1", email, name: "Sam", image: null } });
  mocks.findUnique.mockResolvedValue({ role: who === "creator" || who === "owner-and-creator" ? "CREATOR" : "LEARNER" });
}

const ok = { ok: true, videoId: "v1", uploadUrl: "https://upload.example/1", completed: false };
const inputs: [string, (input: unknown) => Promise<unknown>, unknown, keyof typeof mocks.service][] = [
  ["createUpload", createUpload, { kind: "first", videoId: "v1" }, "createUpload"],
  ["saveDraft", saveDraft, { videoId: "v1", details: { title: "Hi" } }, "saveDraft"],
  ["submitVideo", submitVideo, { videoId: "v1", details: { title: "Hi" }, checklist: [true, true, true, true, true] }, "submitVideo"],
  ["deleteDraft", deleteDraft, { videoId: "v1" }, "deleteDraft"],
];

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.findUnique.mockReset();
  for (const fn of Object.values(mocks.service)) fn.mockReset().mockResolvedValue(ok);
});

describe.each(inputs)("%s", (_name, action, input, method) => {
  it("sends a signed-out visitor to sign in and does nothing", async () => {
    as("signed-out");
    await expect(action(input)).rejects.toThrow(/^REDIRECT:\/sign-in/);
    expect(mocks.service[method]).not.toHaveBeenCalled();
  });

  it.each(["learner", "owner"] as const)("turns away a %s with a not-found page and does nothing", async (who) => {
    as(who);
    await expect(action(input)).rejects.toThrow("NOT_FOUND");
    expect(mocks.service[method]).not.toHaveBeenCalled();
  });

  it("lets a creator through, acting as that creator", async () => {
    as("creator");
    await action(input);
    expect(mocks.service[method]).toHaveBeenCalledTimes(1);
    expect(mocks.service[method].mock.calls[0][0]).toMatchObject({ id: "u1", role: "creator" });
  });

  it("lets an owner who is also a creator through", async () => {
    as("owner-and-creator");
    await action(input);
    expect(mocks.service[method]).toHaveBeenCalledTimes(1);
    expect(mocks.service[method].mock.calls[0][0]).toMatchObject({ id: "u1", role: "owner", isCreator: true });
  });

  it("refuses input of the wrong shape without calling the service", async () => {
    as("creator");
    const result = await action({ videoId: 42, kind: "sideways", details: "x", checklist: "yes" });
    expect(result).toMatchObject({ ok: false });
    expect(mocks.service[method]).not.toHaveBeenCalled();
  });
});

describe("the actions' answers", () => {
  it("hand back the one-time link and the video id only, never a Mux id", async () => {
    as("creator");
    mocks.service.createUpload.mockResolvedValue({ ok: true, videoId: "v1", uploadUrl: "https://upload.example/1", muxUploadId: "up-secret" });
    expect(await createUpload({ kind: "first" })).toEqual({ ok: true, videoId: "v1", uploadUrl: "https://upload.example/1" });
  });

  it("turn a refusal into one plain sentence, naming the missing items of a submission", async () => {
    as("creator");
    mocks.service.submitVideo.mockResolvedValue({ ok: false, reason: "invalid", problems: [{ field: "title", message: "Give your video a title." }] });
    const result = await submitVideo({ videoId: "v1", details: {}, checklist: [false, false, false, false, false] });
    expect(result).toEqual({ ok: false, message: "A few things to finish first.", fields: { title: "Give your video a title." } });
    mocks.service.createUpload.mockResolvedValue({ ok: false, reason: "not-set-up" });
    expect(await createUpload({ kind: "first" })).toEqual({ ok: false, message: "Uploads aren't set up yet. Please try again soon." });
  });
});
