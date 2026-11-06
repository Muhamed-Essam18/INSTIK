import { EMPTY_DRAFT, parseDraft, type Draft } from "@/lib/onboarding/draft";
import { readRaw, removeStoredWhere, writeStored } from "@/lib/player/preferences";

export const ONBOARDING_KEY = "instik:v1:onboarding";

/** The saved choices, cleaned against the languages on offer. Never throws; unreadable data is the empty draft. */
export function readDraft(languageCodes: readonly string[]): Draft {
  const raw = readRaw(ONBOARDING_KEY);
  if (raw === null) return EMPTY_DRAFT;
  try {
    return parseDraft(JSON.parse(raw), languageCodes);
  } catch {
    return EMPTY_DRAFT;
  }
}

/** Saves the choices on this device (or for this visit only when storage is blocked). */
export function saveDraft(draft: Draft): void {
  writeStored(ONBOARDING_KEY, draft);
}

/** Forgets the onboarding choices on this device (after sign-up, and on sign-out). */
export function clearDraft(): void {
  removeStoredWhere((key) => key === ONBOARDING_KEY);
}
