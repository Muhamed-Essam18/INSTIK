// Learner-facing words for hours, the roadmap and Done for today. Short, warm, honest, never shaming.
// Stage names only: internal content levels never appear here.
import type { Stage } from "@/lib/learner/profile-rules";
import { STAGE_NAMES } from "@/lib/learner/profile-rules";
import { splitHoursMinutes } from "./totals";

export const STAGE_DESCRIPTIONS: Record<Stage, string> = {
  HEAR_IT: "Sounds and first words.",
  FOLLOW_IT: "Slow, everyday conversations.",
  UNDERSTAND_IT: "Natural speech on familiar topics.",
  JOIN_IN: "Speaking, when it comes naturally.",
};

/** The big line on the Roadmap: "12 hours of Egyptian Arabic so far. Nice." */
export function heroHeading(totalSeconds: number, languageName: string): string {
  const { hours } = splitHoursMinutes(totalSeconds);
  if (hours < 1) return "Your first hour is waiting.";
  return `${hours} ${hours === 1 ? "hour" : "hours"} of ${languageName} so far. Nice.`;
}

/** The supporting line under the heading, by stage. */
export function heroSupport(stage: Stage, languageName: string): string {
  switch (stage) {
    case "HEAR_IT":
      return `You're getting used to the sounds of ${languageName}. Every hour counts.`;
    case "FOLLOW_IT":
      return `You can now follow slow, everyday ${languageName}. That's real.`;
    case "UNDERSTAND_IT":
      return `Natural ${languageName} on familiar topics is starting to make sense.`;
    case "JOIN_IN":
      return `You understand a lot of ${languageName}. Speaking comes naturally from here.`;
  }
}

export const HONEST_NOTE =
  "Only real watching counts: time with a video playing and Instik open. Time outside Instik counts too if you add it.";

/** The estimate line on the current stage card. */
export function moreHoursLine(moreHours: number | null, nextStage: Stage | undefined): string | null {
  if (!nextStage) return null;
  if (moreHours === null) return null;
  return `About ${moreHours} more ${moreHours === 1 ? "hour" : "hours"} to ${STAGE_NAMES[nextStage]} (an estimate)`;
}

/** Shown on the current stage when the learner is past the estimate, or no number exists. */
export const PAST_ESTIMATE_LINE = "You're past the estimate. Keep going at your own pace.";
