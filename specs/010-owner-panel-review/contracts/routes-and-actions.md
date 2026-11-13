# Contract: Owner routes and server actions

All routes live under `(panel)/owner`. Every page calls `requireOwner(path)` (signed out: sign-in redirect; any other role: not found).
Every action calls it again, validates input with zod, and returns plain data, never a Mux id, a token or another person's address.

## Pages

| Path | Purpose |
|------|---------|
| `/owner` | Review queue: four counts and the table (oldest submission first). |
| `/owner/review/[id]` | Review screen for one video. Videos not In review or Changes requested look like a missing page. In Changes requested it is read-only. |
| `/owner/waiting` | Videos in Changes requested, oldest first, same columns as the queue; linked from the "Waiting on creator" count. Each opens its review screen read-only. |
| `/owner/creators` | Invite form, creators and invitees table. |
| `/owner/creators/[id]` | One creator's stats (id is the creator's account id). |

## Review actions (`src/lib/review/actions.ts`)

| Action | Input | Result |
|--------|-------|--------|
| `setChecklist` | `{ videoId, key, checked }` | `{ ok }` or refusal (video not In review). |
| `setClassification` | `{ videoId, stage, access }` | `{ ok }`; stage must be a taxonomy slug, access `FREE` or `FULL`. |
| `saveSegment` | `{ videoId, segmentId?, revision?, start, end, script, transliteration, english }` | `{ ok, segment }` (new revision) or `{ ok:false, reason: "invalid" \| "overlap" \| "conflict" \| "not-in-review", problems }`. |
| `deleteSegment` | `{ videoId, segmentId, revision }` | `{ ok }` or `conflict`. |
| `previewVtt` | `{ videoId, text }` | `{ ok, count, first, last, problems }`; nothing is written. Text limited to 1 MB. |
| `importVtt` | `{ videoId, text, mode: "add" \| "replace" }` | `{ ok, count }` or refusal; one transaction. |
| `addGlossaryEntry` | `{ videoId, word, transliteration, english }` | `{ ok, entry }` or `{ ok:false, reason:"exists", entry }`. |
| `updateGlossaryEntry` | `{ videoId, entryId, transliteration, english }` | `{ ok }`. |
| `decide` | `{ videoId, decision: "approve" \| "changes" \| "reject", note? }` | `{ ok, emailSent }` or refusal: `not-in-review`, `checklist`, `no-transcript`, `not-ready`, `note-required`, `note-too-long`. |

A refusal never changes data. A failed email returns `{ ok: true, emailSent: false }`.

## Creator management actions (`src/lib/creators/actions.ts`, `src/lib/invites/actions.ts`)

| Action | Input | Result |
|--------|-------|--------|
| `createInvite` | existing | unchanged (spec 8). |
| `resendInvite` | `{ email }` | `{ ok }` or `not-resendable`, `too-many`, `send-failed`. |
| `pauseCreator` | `{ creatorId }` | `{ ok }`; refused for non-creators and for owners. Idempotent. |
| `resumeCreator` | `{ creatorId }` | `{ ok }`. Idempotent. |

## Reads (owner only; each takes the acting owner and throws `ForbiddenError` otherwise)

| Function | Returns |
|----------|---------|
| `getQueue(actor, { list })` (`list` is `review` or `waiting`) | Counts and rows; the `waiting` list is the Changes requested videos. Each row: title, creator name, proposed stage, duration, submitted date, days waiting, badge, whether a transcript exists. |
| `getReview(actor, videoId)` | Video details, checklist, classification, segments with revisions and matched-word marks, decision emails, history, signed playback. |
| `listCreators(actor)` | Rows with status and counts of live, in review and changes requested videos. |
| `getCreatorStats(actor, creatorId)` | Counts by status, approved this month, joined and last upload dates. |

## Creator-side effects (existing routes)

- `canUpload` refuses a paused creator: `createUpload`, `saveDraft`, `submitVideo`, `deleteDraft` and the host page writes `saveHost` and `uploadPhoto` return `not-allowed` with the existing
  message, plus a calm "Uploads are paused for now. Your videos are safe." line in the creator panel.
- My videos and the status page already read the latest history entry, so a decision and its note appear without further work.
