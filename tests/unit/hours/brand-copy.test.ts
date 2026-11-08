import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Brand behaviours as acceptance criteria (constitution II): no streaks, nothing shaming, stage names only,
// hour thresholds always "an estimate". This scans the learner-facing source of the hours screens.

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

const sources = [
  "src/components/roadmap",
  "src/components/done",
  "src/components/screens/RoadmapScreen.tsx",
  "src/components/screens/DoneScreen.tsx",
  "src/components/shell/HoursPill.tsx",
  "src/lib/hours/copy.ts",
].flatMap(files);

/** Code and copy without comments, so a note like "no streaks" in a comment is not mistaken for learner copy. */
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// The only learner-facing sentences that may contain these words, and they say the opposite of the bad thing.
const allowed = ["No streaks. A rest day never costs you anything.", "Missed a day? That's fine. Nothing is lost."];
const withoutAllowed = (text: string) => allowed.reduce((t, a) => t.split(a).join(""), text);

describe("brand copy in the hours screens", () => {
  it("finds the files to check", () => {
    expect(sources.length).toBeGreaterThan(8);
  });

  it.each(sources)("%s has no streak, shaming or internal-level wording", (file) => {
    const text = withoutAllowed(strip(readFileSync(file, "utf8")));
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/you missed|lost your|days lost|overdue|behind schedule|falling behind|don't break/i);
    expect(text).not.toMatch(/Superbeginner|Beginner|Intermediate|Advanced/);
  });

  it("never shows a stage estimate without calling it an estimate", () => {
    const copy = readFileSync("src/lib/hours/copy.ts", "utf8");
    expect(copy).toContain("(an estimate)");
    const stageList = readFileSync("src/components/roadmap/StageList.tsx", "utf8");
    expect(strip(stageList)).not.toMatch(/more hours/i); // the wording lives in copy.ts only
  });

  it("keeps the allowed lines word for word", () => {
    const rhythm = readFileSync("src/components/roadmap/RhythmGrid.tsx", "utf8");
    expect(rhythm).toContain(allowed[0]);
    const strip_ = readFileSync("src/components/done/WeekStrip.tsx", "utf8");
    expect(strip_.replace("&apos;", "'")).toContain(allowed[1]);
  });
});
