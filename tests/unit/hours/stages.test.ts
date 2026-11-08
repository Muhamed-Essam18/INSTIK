import { describe, expect, it } from "vitest";
import { advanceStage, moreHours, nextStage, stageProgress, stageStates, thresholdFor } from "@/lib/hours/stages";
import type { RoadmapEstimates } from "@/lib/languages.schema";

const estimates: RoadmapEstimates = {
  provisional: true,
  note: "Placeholder",
  stages: [
    { stage: "HEAR_IT", upToHours: 30 },
    { stage: "FOLLOW_IT", upToHours: 100 },
    { stage: "UNDERSTAND_IT", upToHours: 250 },
  ],
};

describe("advanceStage", () => {
  it("moves forward when hours pass the estimate", () => {
    expect(advanceStage("HEAR_IT", 29, estimates)).toBe("HEAR_IT");
    expect(advanceStage("HEAR_IT", 30, estimates)).toBe("HEAR_IT");
    expect(advanceStage("HEAR_IT", 30.01, estimates)).toBe("FOLLOW_IT");
  });

  it("jumps several stages for a large total", () => {
    expect(advanceStage("HEAR_IT", 500, estimates)).toBe("JOIN_IN");
    expect(advanceStage("FOLLOW_IT", 120, estimates)).toBe("UNDERSTAND_IT");
    expect(advanceStage("FOLLOW_IT", 260, estimates)).toBe("JOIN_IN");
  });

  it("never goes back", () => {
    expect(advanceStage("UNDERSTAND_IT", 1, estimates)).toBe("UNDERSTAND_IT");
    expect(advanceStage("FOLLOW_IT", 0, estimates)).toBe("FOLLOW_IT");
  });

  it("stays put without estimates and at the last stage", () => {
    expect(advanceStage("HEAR_IT", 9999, undefined)).toBe("HEAR_IT");
    expect(advanceStage("JOIN_IN", 9999, estimates)).toBe("JOIN_IN");
  });
});

describe("stageProgress", () => {
  it("measures from the end of the previous stage and clamps", () => {
    expect(stageProgress("HEAR_IT", 15, estimates)).toBe(0.5);
    expect(stageProgress("FOLLOW_IT", 65, estimates)).toBe(0.5);
    expect(stageProgress("FOLLOW_IT", 400, estimates)).toBe(1);
  });

  it("is 0 when the learner started at a later stage than their hours", () => {
    expect(stageProgress("FOLLOW_IT", 5, estimates)).toBe(0);
    expect(stageProgress("UNDERSTAND_IT", 0, estimates)).toBe(0);
  });

  it("is 0 without an estimate", () => {
    expect(stageProgress("FOLLOW_IT", 50, undefined)).toBe(0);
    expect(stageProgress("JOIN_IN", 500, estimates)).toBe(0);
  });
});

describe("moreHours", () => {
  it("rounds up to whole hours", () => {
    expect(moreHours("FOLLOW_IT", 87.2, estimates)).toBe(13);
    expect(moreHours("HEAR_IT", 29.99, estimates)).toBe(1);
  });

  it("is null without an estimate and null, never negative, once past it", () => {
    expect(moreHours("FOLLOW_IT", 50, undefined)).toBeNull();
    expect(moreHours("JOIN_IN", 50, estimates)).toBeNull();
    expect(moreHours("FOLLOW_IT", 100, estimates)).toBeNull();
    expect(moreHours("FOLLOW_IT", 130, estimates)).toBeNull();
  });
});

describe("stage states and helpers", () => {
  it("labels done, here, next and later", () => {
    expect(stageStates("FOLLOW_IT").map((s) => s.state)).toEqual(["done", "here", "next", "later"]);
    expect(stageStates("HEAR_IT").map((s) => s.state)).toEqual(["here", "next", "later", "later"]);
    expect(stageStates("JOIN_IN").map((s) => s.state)).toEqual(["done", "done", "done", "here"]);
  });

  it("finds thresholds and next stages", () => {
    expect(thresholdFor("FOLLOW_IT", estimates)).toBe(100);
    expect(thresholdFor("JOIN_IN", estimates)).toBeUndefined();
    expect(nextStage("HEAR_IT")).toBe("FOLLOW_IT");
    expect(nextStage("JOIN_IN")).toBeUndefined();
  });
});
