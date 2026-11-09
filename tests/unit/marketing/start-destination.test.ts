import { describe, expect, it } from "vitest";
import { startDestination } from "@/lib/marketing/start-destination";

describe("startDestination", () => {
  it("sends a signed-out visitor to onboarding", () => {
    expect(startDestination(null, "arabic-egyptian")).toBe("/onboarding");
  });
  it("sends a signed-in learner to the library", () => {
    expect(startDestination({ id: "u1" }, "arabic-egyptian")).toBe("/learn/arabic-egyptian");
  });
});
