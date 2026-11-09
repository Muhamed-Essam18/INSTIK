import type { Language } from "@/lib/languages.schema";

export const ESTIMATE_PLACEHOLDER = "[~X hours]";

type Stage = "HEAR_IT" | "FOLLOW_IT" | "UNDERSTAND_IT" | "JOIN_IN";

/** The hours estimate shown for a stage: a placeholder while the language's estimates are missing or provisional. */
export function stageEstimateLabel(language: Pick<Language, "roadmap">, stage: Stage): string {
  const roadmap = language.roadmap;
  if (!roadmap || roadmap.provisional || stage === "JOIN_IN") return ESTIMATE_PLACEHOLDER;
  const entry = roadmap.stages.find((s) => s.stage === stage);
  return entry ? `about ${entry.upToHours} hours` : ESTIMATE_PLACEHOLDER;
}
