import type { Level, Minutes } from "@/lib/learner/profile-rules";

// The text of docs/design/Onboarding.dc.html in one place.

export const languageStep = {
  title: "What do you want to pick up?",
  sub: "You can add more languages later.",
  available: "Available",
  comingLater: "Coming later",
  waitlist: "Join the waitlist",
  somethingElse: { name: "Something else", note: "Tell us which one you'd like next" },
} as const;

/** The language name as the learner reads it, for example "Egyptian Arabic". */
export const languageStepTitle = (languageName: string) => `How much ${languageName} do you know?`;

export const levelStep = {
  sub: "A rough guess is fine. You can change it any time.",
  groupLabel: "Your level",
  options: [
    { id: "none", title: "None at all", sub: "Maybe a word or two", stage: "Hear it" },
    { id: "few", title: "Some words and phrases", sub: "Greetings, numbers, a few songs", stage: "Hear it" },
    { id: "slow", title: "I can follow slow, simple talk", sub: "With visuals and context", stage: "Follow it" },
    { id: "most", title: "I understand a lot of everyday talk", sub: "But fast speech loses me", stage: "Understand it" },
  ] satisfies ReadonlyArray<{ id: Level; title: string; sub: string; stage: string }>,
  checkLead: "Not sure?",
  checkLink: "Try a short listening check",
  checkTail: "It's optional and there's no score.",
  checkSoon: "A short listening check is coming. For now, pick what feels closest. You can change it any time.",
} as const;

export const timeStep = {
  title: "How long do you usually have?",
  sub: "We'll tell you when that's enough for today. No streaks, nothing to lose.",
  groupLabel: "Time per day",
  options: [10, 20, 30, 60].map((m) => ({ id: m as Minutes, label: `${m} min` })),
} as const;

export const accountStep = {
  title: "Save your hours",
  sub: "Create a free account so every minute you watch is counted.",
  signedIn: "You're signed in.",
  start: "Start watching",
} as const;

export const nav = { back: "Back", next: "Continue" } as const;
