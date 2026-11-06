# Contract: Server actions

All actions are server actions. Each one: (1) parses its input with zod, (2) for anything about a learner, calls `requireLearner()` and uses the session's user id, never an id sent by the client, (3) returns a small typed result instead of throwing for expected problems. Error codes map to short, kind messages in the interface.

## Sign-in (`src/lib/auth/actions.ts`)

| Action | Input | Result | Notes |
|---|---|---|---|
| `requestEmailLink` | `{ email, returnTo? }` | `{ ok: true }` or `{ ok: false, code: "invalid-email" \| "too-many" }` | Checks the send limits (5 per address and 20 per visitor per hour, 30 seconds between sends to one address), then asks Auth.js to send the link. Always `ok: true` for a valid email within limits, whether or not the address has an account. Redirects to `/sign-in/check-email` |
| `signInWithGoogle` | `{ returnTo? }` | redirect | Starts Google sign-in; the callback goes to `/onboarding/finish?returnTo=…` |
| `signOutAction` | none | redirect to `/` | Deletes the database session |

## Profiles (`src/lib/learner/actions.ts`)

| Action | Input | Result | Rules |
|---|---|---|---|
| `completeOnboarding` | `{ languageCode, stage, minutesPerDay, replaceExisting? }` | `{ ok: true }` or `{ ok: false, code: "unavailable-language" \| "invalid" \| "exists" }` | Creates the profile. If the learner already has one for that language it returns `exists` and changes nothing unless `replaceExisting` is true (FR-021). `stage` is derived by the client from the level option using the shared rule, and re-checked on the server |
| `addLanguage` | `{ languageCode, stage, minutesPerDay }` | `{ ok: true }` or `{ ok: false, code: "unavailable-language" \| "exists" \| "invalid" }` | Same rules as `completeOnboarding` without `replaceExisting`; a duplicate is refused |
| `updateProfile` | `{ languageCode, stage?, minutesPerDay? }` | `{ ok: true }` or `{ ok: false, code: "not-found" \| "invalid" }` | Changes only the named profile of the signed-in learner |

## Transcript choices and answers (`src/lib/learner/preference-actions.ts`)

| Action | Input | Result | Rules |
|---|---|---|---|
| `saveLayers` | `{ languageCode, layers }` | `{ ok: true }` or `{ ok: false, code: "no-profile" \| "invalid" }` | Replaces the profile's layers. Keys must be the language's `transcriptLayers`; values boolean |
| `saveAnswer` | `{ languageCode, videoSlug, answer }` | `{ ok: true }` or `{ ok: false, code: "no-profile" \| "unknown-video" \| "invalid" }` | Upserts the one answer for that video; the language must be one the learner has |
| `importDevicePreferences` | `{ layers: { [languageCode]: layers }, answers: { [languageCode]: { [videoSlug]: answer } } }` | `{ ok: true, imported: { layers: number, answers: number } }` | Applies the merge in `device-import.ts`: account layers win, existing account answers win, missing ones are imported; entries for languages without a profile or videos that do not exist are skipped and reported as not imported so the client keeps them on the device. Safe to run twice |

## Client behaviour the actions rely on

- The device draft is cleared only after `completeOnboarding` returns `ok`.
- Device keys for layers and answers are removed only for the entries `importDevicePreferences` reports as imported or already present.
- A failed `saveLayers` or `saveAnswer` shows a short quiet note and keeps the choice on screen; the next call sends the full current state.
- No action reads or writes another learner's data: every query includes the session user's id.
