import { describe, expect, it } from "vitest";
import raw from "../../../content/languages.json";
import { parseLanguagesFile } from "@/lib/languages.schema";

type Entry = Record<string, unknown> & { roadmap?: { provisional?: boolean; stages: Array<Record<string, unknown>> } };
const clone = () => structuredClone(raw) as unknown as { languages: Entry[] };

function messageFor(data: unknown): string {
  try {
    parseLanguagesFile(data);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected parseLanguagesFile to throw");
}

describe("languages roadmap estimates", () => {
  it("accepts the shipped provisional block", () => {
    const languages = parseLanguagesFile(raw);
    expect(languages[0].roadmap?.provisional).toBe(true);
    expect(languages[0].roadmap?.stages.map((s) => s.upToHours)).toEqual([30, 100, 250]);
  });

  it("accepts a language with no roadmap block", () => {
    const d = clone();
    delete d.languages[0].roadmap;
    expect(() => parseLanguagesFile(d)).not.toThrow();
  });

  it("requires the provisional flag", () => {
    const d = clone();
    delete d.languages[0].roadmap!.provisional;
    expect(messageFor(d)).toContain("provisional");
  });

  it("rejects Join in", () => {
    const d = clone();
    d.languages[0].roadmap!.stages.push({ stage: "JOIN_IN", upToHours: 400 });
    expect(messageFor(d)).toContain("stage");
  });

  it("rejects a repeated stage", () => {
    const d = clone();
    d.languages[0].roadmap!.stages[1].stage = "HEAR_IT";
    expect(messageFor(d)).toContain("repeated or out of order");
  });

  it("rejects stages out of order", () => {
    const d = clone();
    const stages = d.languages[0].roadmap!.stages;
    [stages[0].stage, stages[1].stage] = [stages[1].stage, stages[0].stage];
    expect(messageFor(d)).toContain("out of order");
  });

  it("rejects thresholds that do not increase", () => {
    const d = clone();
    d.languages[0].roadmap!.stages[1].upToHours = 20;
    expect(messageFor(d)).toContain("greater than the stage before it");
  });

  it.each([0, -5])("rejects upToHours of %s", (hours) => {
    const d = clone();
    d.languages[0].roadmap!.stages[0].upToHours = hours;
    expect(messageFor(d)).toContain("above 0");
  });
});
