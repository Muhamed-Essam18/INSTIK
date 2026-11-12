import { beforeEach, describe, expect, it, vi } from "vitest";

// The role gates of the Data Access Layer with the session, the database and the environment mocked:
// signed out goes to sign in, any other role gets a not-found page, and the owner list is read on every call.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  ownerEmails: { value: "" as string | undefined },
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: () => ({ user: { findUnique: mocks.findUnique } }) }));
vi.mock("@/lib/env", () => ({ env: () => ({ OWNER_EMAILS: mocks.ownerEmails.value }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
// `cache` would keep a result between calls in one test file; make it a plain function.
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { getActor, requireCreator, requireOwner, requireRole } from "@/lib/session";

const session = (email: string) => ({ user: { id: "u1", email, name: "Sam", image: null } });

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue(null);
  mocks.findUnique.mockReset().mockResolvedValue({ role: "LEARNER" });
  mocks.ownerEmails.value = "boss@instik.test";
});

describe("signed out", () => {
  it("is sent to sign in and comes back to the page", async () => {
    await expect(requireOwner("/owner")).rejects.toThrow("REDIRECT:/sign-in?returnTo=%2Fowner");
    await expect(requireCreator("/creator")).rejects.toThrow("REDIRECT:/sign-in?returnTo=%2Fcreator");
  });

  it("has no actor", async () => {
    expect(await getActor()).toBeNull();
  });
});

describe("a learner", () => {
  beforeEach(() => mocks.auth.mockResolvedValue(session("learner@x.com")));

  it("is turned away from the creator and owner areas with a not-found page", async () => {
    await expect(requireOwner("/owner")).rejects.toThrow("NOT_FOUND");
    await expect(requireCreator("/creator")).rejects.toThrow("NOT_FOUND");
  });

  it("passes the learner gate", async () => {
    expect((await requireRole("learner", "/x")).role).toBe("learner");
  });
});

describe("a creator", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue(session("creator@x.com"));
    mocks.findUnique.mockResolvedValue({ role: "CREATOR" });
  });

  it("is turned away from the owner area and passes the creator gate", async () => {
    await expect(requireOwner("/owner")).rejects.toThrow("NOT_FOUND");
    expect((await requireCreator("/creator")).role).toBe("creator");
  });
});

describe("an owner", () => {
  beforeEach(() => mocks.auth.mockResolvedValue(session("boss@instik.test")));

  it("passes the owner gate and is turned away from the creator area", async () => {
    expect((await requireOwner("/owner")).role).toBe("owner");
    await expect(requireCreator("/creator")).rejects.toThrow("NOT_FOUND");
  });

  it("loses owner access at the next check when the email leaves the list", async () => {
    expect((await getActor())?.role).toBe("owner");
    mocks.ownerEmails.value = "";
    expect((await getActor())?.role).toBe("learner");
    await expect(requireOwner("/owner")).rejects.toThrow("NOT_FOUND");
  });

  it("reads the role fresh from the database", async () => {
    mocks.ownerEmails.value = undefined;
    mocks.findUnique.mockResolvedValue({ role: "CREATOR" });
    expect((await getActor())?.role).toBe("creator");
  });
});

describe("a session whose user no longer exists", () => {
  it("has no actor", async () => {
    mocks.auth.mockResolvedValue(session("ghost@x.com"));
    mocks.findUnique.mockResolvedValue(null);
    expect(await getActor()).toBeNull();
  });
});
