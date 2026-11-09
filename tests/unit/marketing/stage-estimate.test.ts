import { describe, expect, it } from "vitest";
import { defaultLanguage } from "@/lib/languages";
import { stageEstimateLabel } from "@/lib/marketing/stage-estimate";

const final = {
  roadmap: {
    provisional: false,
    note: "Final",
    stages: [
      { stage: "HEAR_IT", upToHours: 30 },
      { stage: "FOLLOW_IT", upToHours: 100 },
    ],
  },
} as const;

describe("stageEstimateLabel", () => {
  it("shows the placeholder for every stage while the launch language's estimates are provisional", () => {
    for (const stage of ["HEAR_IT", "FOLLOW_IT", "UNDERSTAND_IT", "JOIN_IN"] as const) {
      expect(stageEstimateLabel(defaultLanguage, stage)).toBe("[~X hours]");
    }
  });
  it("shows the number once the estimates are final", () => {
    expect(stageEstimateLabel(final as never, "HEAR_IT")).toBe("about 30 hours");
    expect(stageEstimateLabel(final as never, "FOLLOW_IT")).toBe("about 100 hours");
  });
  it("shows the placeholder for a stage with no estimate, for Join in, and for a missing roadmap", () => {
    expect(stageEstimateLabel(final as never, "UNDERSTAND_IT")).toBe("[~X hours]");
    expect(stageEstimateLabel(final as never, "JOIN_IN")).toBe("[~X hours]");
    expect(stageEstimateLabel({ roadmap: undefined }, "HEAR_IT")).toBe("[~X hours]");
  });
});
