import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAUSED_MESSAGE } from "@/lib/creator/messages";
import { buildDecisionEmail } from "@/lib/review/email";
import { decisionResult, refusal, type ReviewReason } from "@/lib/review/messages";
import { resendMessage } from "@/lib/invites/messages";

// Brand behaviours as acceptance criteria (constitution II, spec 10 FR-030): short, warm, never shaming; no streaks, no tests,
// no infinite scroll. Scans the new copy and the new screens' source.

const reasons = ["not-found", "not-in-review", "invalid", "overlap", "conflict", "too-many", "checklist", "no-transcript", "not-ready", "no-stage", "note-required", "note-too-long", "exists", "no-entry"] as const satisfies readonly ReviewReason[];

const copy = [
  ...reasons.map((r) => refusal(r).message),
  decisionResult("approve", true, "Salma"),
  decisionResult("changes", false, "Salma"),
  decisionResult("reject", true, "Salma"),
  PAUSED_MESSAGE,
  ...(["forbidden", "not-resendable", "too-many", "send-failed"] as const).map(resendMessage),
  ...(["approved", "changes", "rejected"] as const).map((outcome) => buildDecisionEmail({ outcome, title: "T", creatorName: "Salma", note: null, link: "x" }).text),
];

describe("the new messages", () => {
  it("are short sentences, never shaming or alarming", () => {
    for (const text of copy.slice(0, 18)) {
      expect(text.length, text).toBeLessThan(200);
      expect(text, text).not.toMatch(/failed|error|invalid|wrong|you must|forbidden|denied|illegal|violation|streak|overdue|behind|lost/i);
    }
  });

  it("say what to do next when something did not work, in plain words", () => {
    expect(refusal("note-required").message).toMatch(/Be specific and kind/);
    expect(refusal("conflict").message).toMatch(/Reload/);
    expect(refusal("checklist").message).toMatch(/Tick every item/);
    expect(decisionResult("approve", false, "Salma")).toMatch(/Please tell them yourself/);
  });

  it("the pause message is calm and reassuring", () => {
    expect(PAUSED_MESSAGE).toBe("Uploads are paused for now. Your videos are safe.");
  });

  it("a rejection email thanks the creator and says the video will not go live, without blame", () => {
    const text = buildDecisionEmail({ outcome: "rejected", title: "T", creatorName: "Salma", note: "Not a fit.", link: "x" }).text;
    expect(text).toMatch(/Thank you/);
    expect(text).not.toMatch(/fail|unfortunately|violat|reject(ed)? because|your fault/i);
  });
});

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the new screens", () => {
  const sources = ["src/components/owner", "src/components/screens/OwnerQueueScreen.tsx", "src/components/screens/OwnerReviewScreen.tsx", "src/components/screens/OwnerWaitingScreen.tsx", "src/components/screens/OwnerCreatorsScreen.tsx", "src/components/screens/OwnerCreatorScreen.tsx"].flatMap(files);

  it("finds the files", () => expect(sources.length).toBeGreaterThan(15));

  it.each(sources)("%s has no streak, infinite scroll, test or shaming wording", (file) => {
    const text = strip(readFileSync(file, "utf8"));
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/IntersectionObserver|infinite|load more|show more/i);
    expect(text).not.toMatch(/quiz|\bscore\b|you missed|overdue|falling behind/i);
  });

  it("every Arabic block states its direction and language", () => {
    const row = readFileSync("src/components/owner/SegmentRow.tsx", "utf8");
    expect(row).toMatch(/lang=\{lang\}/);
    expect(row).toMatch(/dir=\{dir\}/);
    expect(readFileSync("src/components/owner/WordPanel.tsx", "utf8")).toMatch(/lang=\{lang\} dir=\{dir\}/);
    const screen = readFileSync("src/components/screens/OwnerReviewScreen.tsx", "utf8");
    expect(screen).toMatch(/language\.direction/);
    expect(screen).toMatch(/language\.code/);
  });

  it("uses colour tokens only, never raw colours", () => {
    for (const file of sources) expect(strip(readFileSync(file, "utf8")), file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});
