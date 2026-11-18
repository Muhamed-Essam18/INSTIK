// What the owner reads when a review action does not go through: short, plain and kind, never a status name or a Mux detail.

export type ReviewFailure = { ok: false; kind: string; message: string };

export const INPUT_PROBLEM = { ok: false, kind: "input", message: "Something in that wasn't quite right. Please check and try again." } as const;

const copy = {
  "not-found": "We couldn't find that video.",
  "not-in-review": "This video isn't waiting for review any more, so nothing was changed. Reload to see where it is now.",
  invalid: "Something in that wasn't quite right. Please check and try again.",
  overlap: "This overlaps another segment. Change the times so they don't.",
  conflict: "Someone else changed this just now. Reload this segment to see their version.",
  "too-many": "A transcript can have at most 2,000 segments.",
  checklist: "Tick every item in the checklist first.",
  "no-transcript": "Add at least one transcript segment first.",
  "not-ready": "This video isn't ready to publish yet: it needs a title, a topic and a finished video file.",
  "no-stage": "Choose a stage first.",
  "note-required": "Write a short note to the creator first. Be specific and kind.",
  "note-too-long": "That note is a bit long. Please keep it to 2,000 characters.",
  exists: "That word is already in the glossary.",
  "no-entry": "We couldn't find that glossary entry.",
} as const;

export type ReviewReason = keyof typeof copy;

/** The refusal as an action result: the reason (for the screen to react to) and the words to show. */
export const refusal = (reason: ReviewReason): { ok: false; kind: ReviewReason; message: string } => ({ ok: false, kind: reason, message: copy[reason] });

/** The line shown after a decision: who has been told, or that the email did not go. */
export const decisionResult = (decision: "approve" | "changes" | "reject", emailSent: boolean, creatorName: string): string => {
  const done = decision === "approve" ? "Approved and published." : decision === "changes" ? "Changes requested." : "Rejected.";
  return emailSent ? `${done} ${creatorName} has been told.` : `${done} We couldn't email ${creatorName}. Please tell them yourself.`;
};
