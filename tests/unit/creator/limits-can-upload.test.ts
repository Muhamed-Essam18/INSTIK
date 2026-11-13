import { describe, expect, it } from "vitest";
import { canUpload } from "@/lib/creator/can-upload";
import {
  MAX_DURATION_SECONDS,
  MAX_UPLOAD_BYTES,
  UPLOAD_GIVE_UP_SECONDS,
  UPLOAD_GRACE_SECONDS,
  UPLOAD_URL_LIFETIME_SECONDS,
} from "@/lib/creator/limits";

describe("the upload limits", () => {
  it("are 4 GB, 30 minutes, a 1 hour link and 15 minutes of grace", () => {
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024 * 1024);
    expect(MAX_DURATION_SECONDS).toBe(30 * 60);
    expect(UPLOAD_URL_LIFETIME_SECONDS).toBe(60 * 60);
    expect(UPLOAD_GRACE_SECONDS).toBe(15 * 60);
    expect(UPLOAD_GIVE_UP_SECONDS).toBe(75 * 60);
  });
});

describe("canUpload", () => {
  it("is true for a creator and for an owner who is also a creator", () => {
    expect(canUpload({ role: "creator" })).toBe(true);
    expect(canUpload({ role: "owner", isCreator: true })).toBe(true);
  });

  it("is false for a learner, an owner who is not a creator, and nobody", () => {
    expect(canUpload({ role: "learner" })).toBe(false);
    expect(canUpload({ role: "owner" })).toBe(false);
    expect(canUpload({ role: "owner", isCreator: false })).toBe(false);
    expect(canUpload(null)).toBe(false);
    expect(canUpload(undefined)).toBe(false);
  });
});
