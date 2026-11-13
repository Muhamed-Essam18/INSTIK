# Research: Owner Panel

No NEEDS CLARIFICATION remained. These are the decisions taken while reading the code.

## 1. How a decision is made atomically

**Decision**: `reviewService.decide` runs one transaction: lock the video row, re-read status, checklist and segment count, check the
guard, call the existing pure `checkTransition` (owner, from IN_REVIEW), write status with the existing conditional update
(`where status = IN_REVIEW`), apply the final stage and access for an approval, append the `VideoStatusEvent`.
**Rationale**: the status service's transaction cannot see checklist or segments; two owners deciding at once must produce exactly one
winner (SC-010) and an approval must not pass on a checklist that changed a moment earlier.
**Alternatives**: a guard callback inside `changeStatus` (couples a shared service to review tables); check then call `changeStatus`
(race between the check and the write).

## 2. Approve guard

**Decision**: approval needs status IN_REVIEW, all five checklist items ticked, at least one transcript segment, a final stage (the owner's
choice, or the creator's proposal when untouched), and what the learner site needs to show a video: title, topic, duration and a playback
id. A missing piece is refused with a plain message naming it.
**Rationale**: `toVideoOrNull` silently drops rows it cannot show, so approving an incomplete video would be "published" yet invisible.

## 3. Checklist storage

**Decision**: a JSON column `reviewChecks` on `Video` with five boolean keys, validated with zod on read and write; cleared when the creator
resubmits (the existing swap-and-submit path in `upload-service`/`store`).
**Rationale**: five ticks with no history of their own; a table adds joins for nothing. The status history already records the decision.
**Alternatives**: five boolean columns (noisier migrations if the list changes); a separate review table (a second thing to keep in step).

## 4. Final stage and access

**Decision**: save into the existing `Video.stage` and `Video.access`. The screen shows the proposal until the owner saves a stage.
**Rationale**: those columns are already defined as "set by the owner"; learners never read non-Approved rows.

## 5. Transcript autosave and concurrent edits

**Decision**: one server action per segment (create, update, delete), each in a transaction that locks the video row, validates against
the other segments (order, overlap, within duration), renumbers `position` by start time, and bumps the segment's `revision`. Updates send
the `revision` they started from; a mismatch returns a "changed by someone else" result and the editor offers to reload that segment.
**Rationale**: matches the "Saved" indicator decision; keeps a long transcript fast; conflicts are per segment.
**Alternatives**: one save for the whole transcript (clashes on any change, loses the clarified autosave behaviour).
**Note**: `@@unique([videoId, position])` forces a two-step renumber (shift to negative, then to final values) inside the transaction.

## 6. VTT import

**Decision**: reuse `parseVtt` for syntax; add a pure mapper from cues to segments. Cue text goes to the Arabic field; a cue with several
lines is joined with a space; tags are stripped. The owner sees a summary (count, first and last time, problems) and chooses Add or Replace
before anything is written; the import is one transaction.
**Rationale**: the existing parser returns line-numbered errors and rejects malformed files, which is the required behaviour. Note that the
existing content-file format (one line per layer per cue) is a different import and is not reused here: the spec says imported text lands in
the Arabic field.

## 7. Glossary

**Decision**: no per-segment link storage. The editor runs `buildGlossaryIndex` and `linkWords` over each saved script (server-side, plain
data to the client) to mark matched words. Adding an entry creates a `GlossaryEntry` with a generated `entryKey`; a word whose matching key is
already taken is refused and the existing entry is shown. Correcting an entry edits meaning or transliteration only.
**Rationale**: it is how the learner site already links; storing links would create two sources of truth.
**Alternatives**: explicit link table (more flexible, not asked for, and would change the learner transcript path).

## 8. Decision email

**Decision**: a new mailer in `lib/review/email.ts` using Resend over `fetch`, the same call as `invites/email.ts`, sent after the
transaction commits. Each send is recorded in `DecisionEmail` keyed by the history event id (unique), so a repeated decision, which the
transaction already refuses, can never produce a second email either. A failure is stored and returned to the owner; the decision stands.
**Rationale**: spec FR-018 and FR-019. Sending inside the transaction would hold a database lock on a network call.
**Alternatives**: a queue with retries (more infrastructure than the spec asks for; a resend button can come later).

## 9. Pause

**Decision**: `User.pausedAt` (null means active) plus an append-only `CreatorPauseEvent` (who, when, paused or resumed). `getActor` reads
`pausedAt` with the role on each request and sets `Actor.paused`; `canUpload` returns false when `paused`. Every creator write already goes
through `canUpload`; a test lists the creator write functions and asserts each refuses a paused creator.
**Rationale**: effect on the next request without signing out (FR-026); one choke point (spec 9 designed it for this).
**What stays open for a paused creator**: sign in, read their panel, statuses and notes. Their Approved videos and host page are untouched
because nothing in the learner reads looks at `pausedAt`.
**Alternatives**: a new `Role` value (would break the role resolution and the "owner who is also creator" case).

## 10. Resend an invite

**Decision**: `resendInvite` reuses `createInvite`'s transaction: revoke the pending (or expired) invitation for that email and create a
new one with a new token and expiry, then email it. Eligibility: the latest invitation for that email is pending or expired and the email is
not an owner or creator.
**Rationale**: spec 8 already treats a newer invitation as superseding older ones; the old link stops working with no new state.
The existing hourly invite limit applies.

## 11. Creators table and stats

**Decision**: rows are creators (accounts with role CREATOR and their host) plus people with a pending or expired invitation and no account
yet. Status: Paused if `pausedAt`, Active if creator, Invited if only an invitation. Counts come from grouped queries over `Video` by status,
excluding soft-deleted. Stats view adds approved-this-month (APPROVED history entries since the first of the month), joined date (the
invitation's `usedAt`) and last upload date (latest `uploadStartedAt`).
**Rationale**: no new tables; counts only, as the spec scopes.

## 12. Owner navigation

**Decision**: add an owner side navigation (Review queue, Creators, a link to the learner site) as a layout under `(panel)/owner`, matching
the designs. The Earnings link is left out until its spec exists.
**Rationale**: the designs show it; the current panel layout has only a header. The creator area already has its own nav component to copy.

## 13. Playback in the review screen

**Decision**: reuse the existing player on the review screen. It takes the video's playback id and access, and for full-access videos the
server signs tokens as the learner page does (`signPlaybackTokens`). Videos sitting in review are signed because the asset policy is signed.
Review playback does not count hours (the owner is not a learner on that page).
**Rationale**: the same access rules as the learner player (FR-004) with no second player.

## 14. Things checked and left alone

- `Video.submittedAt` is not a reliable submission date (cleared on completion); the newest IN_REVIEW history entry is used.
- Learner reads need no cache invalidation (no caching is used), so approval is visible at once.
- Mux webhook, upload service and host page are unchanged except the resubmission path clearing the checklist and `canUpload`.
