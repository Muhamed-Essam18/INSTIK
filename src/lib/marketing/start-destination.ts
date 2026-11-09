import { libraryPath, onboardingPath } from "@/lib/routes";

/** Where "Start watching free" goes: onboarding for a visitor, the library for a signed-in learner. */
export function startDestination(learner: unknown, defaultSlug: string): string {
  return learner ? libraryPath(defaultSlug) : onboardingPath();
}
