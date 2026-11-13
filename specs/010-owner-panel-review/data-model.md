# Data Model: Owner Panel

Changes to `prisma/schema.prisma` (one migration, `owner_review`). Everything else is reused from specs 8 and 9.

## Changed: `User`

| Field | Type | Notes |
|-------|------|-------|
| `pausedAt` | `DateTime?` | Null means the creator is active. Set by an owner; cleared on resume. Meaningful only for creators. |
| `pauseEvents` | relation `"PausedCreator"` | `CreatorPauseEvent[]` where this account is the creator. |
| `pausesMade` | relation `"PauseActor"` | `CreatorPauseEvent[]` this account made as the acting owner. |

## New: `CreatorPauseEvent` (append-only)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id cuid` | |
| `userId` | `String` | The creator (relation `"PausedCreator"`, cascade on delete). |
| `kind` | enum `PAUSED` / `RESUMED` | |
| `actorId` | `String?` | The owner (relation `"PauseActor"`); set null if that account is deleted. |
| `actorLabel` | `String` | Name or email at the time. |
| `createdAt` | `DateTime` | |

Index `(userId, createdAt)`. Like `VideoStatusEvent`, the migration adds a trigger refusing UPDATE and DELETE.

## Changed: `Video`

| Field | Type | Notes |
|-------|------|-------|
| `reviewChecks` | `Json @default("{}")` | Keys `stageFits`, `audio`, `realPeople`, `safe`, `transcript`, each boolean. Validated with zod. Cleared when the creator resubmits. |

`stage` (final) and `access` already exist and are written by the owner during review. `proposedStage` is read-only here.

## Changed: `TranscriptSegment`

| Field | Type | Notes |
|-------|------|-------|
| `revision` | `Int @default(0)` | Incremented on every write; the editor sends the revision it started from. |

Rules (checked in code, inside the transaction that holds the video row lock): `start < end`; no overlap with another segment; `end <=
durationSeconds` when known; `script` non-empty; `position` is the rank by start time, renumbered with a two-step update because of
`@@unique([videoId, position])`.

## New: `DecisionEmail`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id cuid` | |
| `eventId` | `String @unique` | The `VideoStatusEvent` this email is about. Makes "one email per decision" a database fact. |
| `toEmail` | `String` | The creator's address at the time. |
| `outcome` | enum `SENT` / `FAILED` | |
| `failure` | `String?` | Short plain text, at most 200 characters; never a provider response body. |
| `createdAt` | `DateTime` | |

## Reused as is

- `VideoStatusEvent`: the decision record (previous and new status, owner, time, note). "Approved this month" and "submitted" dates come from it.
- `GlossaryEntry`: new entries are inserted with a generated `entryKey`; `word`, `base`, `transliteration`, `english` edited by owners.
- `CreatorInvite`: resend creates a new row and revokes the earlier pending one (existing behaviour).
- `Host`, `Video`, `TranscriptSegment`: otherwise unchanged.

## Derived values (no storage)

| Value | Definition |
|-------|-----------|
| Queue badge | IN_REVIEW with zero segments: "Needs review"; IN_REVIEW with at least one: "Transcript in progress". |
| Waiting on creator | Count of videos in CHANGES_REQUESTED (not deleted). |
| Approved this month | Count of `VideoStatusEvent` with `toStatus = APPROVED` since the first day of the current month in the Europe/Warsaw time zone (spec 11's earnings months will use the same zone). |
| Submitted date, days waiting | Newest `VideoStatusEvent` with `toStatus = IN_REVIEW` for the video; days counted in whole days from that date to today. |
| Creator status | Paused if `pausedAt`; Active if role CREATOR; Invited if only a pending or expired invitation exists. |
| Word is linked | `linkWords` over the script with the language's glossary index. |

## State transitions

Owner moves from spec 8, unchanged: IN_REVIEW to APPROVED, CHANGES_REQUESTED or REJECTED. Approved and Rejected have no way out.
Pause: Active to Paused to Active, each recorded in `CreatorPauseEvent`; no effect on any video status.
