# Data Model: Creator Panel and Video Upload

One migration. Everything else (hosts, events, roles) exists from spec 8.

## Video (changed)

| Field | Change | Notes |
| --- | --- | --- |
| `title` | default `""` | Drafts may be untitled; submit requires 1–120 chars |
| `stage` | now nullable `String?` | The **final** stage, set by the owner in review (spec 10), pre-filled from `proposedStage`. Imported sample videos keep theirs. Slug from `taxonomy.ts` |
| `proposedStage` | new, `String?` | The creator's proposal (slug from `taxonomy.ts`, checked in code). The creator panel shows `proposedStage`, else `stage` |
| `topic` | now nullable `String?` | From `taxonomy.ts` |
| `durationSeconds` | now nullable `Int?` | Set from the webhook; at least 1 and at most 1,800 once set (checked in code) |
| `slug` | `draft-<id>` until first submit | Then from the title, unique per language, numeric suffix on conflict; never changes afterwards |
| `access` | default `FULL` | Only the owner sets it (spec 10) |
| `description` | new, `String?` | Up to 1,000 characters; required to submit |
| `muxUploadId` | new, `String?` | The current file's direct upload |
| `muxAssetId` | new, `String?` | The current file's asset |
| `playbackId` | existing | Signed-policy playback id of the current file once ready |
| `assetReadyAt` | new, `DateTime?` | Set by the webhook when the current asset is ready |
| `submittedAt` | new, `DateTime?` | Set on Submit; cleared when the submission completes, fails, or a new first upload starts |
| `checklistAcceptedAt` | new, `DateTime?` | Set on every submit; proves the checklist was ticked |
| `uploadStartedAt` | new, `DateTime?` | When the current first upload link was created; drives "Upload didn't finish" |
| `pendingUploadId` | new, `String?` | New version while in CHANGES_REQUESTED: its direct upload |
| `pendingAssetId` | new, `String?` | New version: its asset |
| `pendingPlaybackId` | new, `String?` | New version: signed playback id once ready |
| `pendingDurationSeconds` | new, `Int?` | New version: length once ready |
| `pendingReadyAt` | new, `DateTime?` | New version: set by the webhook when ready |
| `pendingStartedAt` | new, `DateTime?` | When the new version's upload link was created |
| `pendingFailure` | new, `String?` | Plain message when the new version failed (up to 200 characters); cleared when a new upload starts |
| `deletedAt` | new, `DateTime?` | Soft delete of a Draft: hidden everywhere (see below) |

Indexes: `@@index([hostId, updatedAt])` for My videos.

Learner tables (progress, hours, answers) refer to a video by language + slug; a Draft has no learner records, so the slug
change at first submit and a soft delete never affect them.

### Soft delete

`deletedAt` is set only for Drafts, by their creator. The row, its status events and its history stay (the append-only trigger on
`VideoStatusEvent` is untouched). Every read filters `deletedAt IS NULL`: creator reads, learner reads, and the owner reads that
spec 10 adds (noted in its plan). The Mux asset (current and pending) is deleted. On delete the slug is reset to `draft-<id>`, so a slug
assigned at an earlier submit is freed and never collides with a real one.

## State transitions (shared with spec 10)

```text
DRAFT ──creator: start upload──▶ UPLOADING ──system: upload asset created──▶ PROCESSING
UPLOADING ──system: cancelled/errored/expired──▶ DRAFT          (new)
PROCESSING ──system: asset error or too long (note)──▶ DRAFT    (existing; note passed by the caller)
PROCESSING ──asset ready AND submitted──▶ IN_REVIEW             (system on the ready notice; creator when submitting after ready — creator move is new)
CHANGES_REQUESTED ──creator: submit (details only, or pending new file ready)──▶ IN_REVIEW   (existing move)
IN_REVIEW ──owner──▶ APPROVED | CHANGES_REQUESTED | REJECTED   (existing, spec 10)
```

The existing move `CHANGES_REQUESTED → UPLOADING` stays in the machine but this spec never uses it: a new version never changes
the status (it lives in the `pending*` fields).

Not a status change (no history entry): save draft, edit details, ticking the checklist, asset ready while not submitted,
anything about a pending new version and its failure, soft delete.

### Completing a submission from CHANGES_REQUESTED

`submitVideo` in CHANGES_REQUESTED: if a pending file exists, it must be ready (else `submittedAt` is set and the webhook finishes
it when ready); on ready the swap happens in one transaction with the status move: `muxUploadId`, `muxAssetId`, `playbackId`,
`assetReadyAt`, `durationSeconds` take the pending values, the `pending*` fields are cleared, then the old Mux asset is deleted
(best effort; its id is held in memory from the transaction). With no pending file the move happens at once.

If a pending file fails after submit, `submittedAt` is cleared and `pendingFailure` is set; the video stays in CHANGES_REQUESTED.

## Validation rules

- Title 1–120 characters; description 1–1,000; proposed stage and topic from `taxonomy.ts`; language available in `languages.json`.
- Upload limits (one constants module, `src/lib/creator/limits.ts`): `MAX_UPLOAD_BYTES = 4 * 1024 ** 3`, `MAX_DURATION_SECONDS = 1800`,
  `UPLOAD_URL_LIFETIME_SECONDS = 3600`, `UPLOAD_GRACE_SECONDS = 900`.
- Submit needs: all of the above, the five checklist items, a complete host page (photo, Latin name, Arabic name, story), and an
  upload started (`muxUploadId` or `pendingUploadId` set) or, from CHANGES_REQUESTED, a ready current file.
- A creator may change details only in `DRAFT`, `UPLOADING`/`PROCESSING` before submission, or `CHANGES_REQUESTED`.
- Delete only in `DRAFT` (including "Ready to submit"), by the owning creator, and not when already deleted.
- `canUpload(actor)` (pure, `src/lib/creator/can-upload.ts`) is the one check before creating an upload or submitting: true for a
  creator (including an owner who is also a creator), false for everyone else. Spec 10 adds "not paused".

## Display status (derived, not stored)

| Stored | Flags | Shown as | Filter |
| --- | --- | --- | --- |
| DRAFT | | Draft | Drafts, All |
| UPLOADING | link older than 1 h + 15 min and no asset | Upload didn't finish | Drafts, All |
| UPLOADING | otherwise | Uploading | All |
| PROCESSING | not ready | Processing | All |
| PROCESSING | ready, not submitted | Ready to submit | Drafts, All |
| IN_REVIEW | | In review | In review, All |
| CHANGES_REQUESTED | no pending file | Changes requested | Changes requested, All |
| CHANGES_REQUESTED | pending, not ready | Changes requested · New version processing | Changes requested, All |
| CHANGES_REQUESTED | pending ready | Changes requested · New version ready to submit | Changes requested, All |
| CHANGES_REQUESTED | pending link older than 1 h + 15 min, no pending asset | Changes requested · New version didn't finish | Changes requested, All |
| REJECTED | | Rejected | All |
| APPROVED | | Live | Live, All |

Soft-deleted videos are in no row.

## Host (existing, edited here)

`name` (Latin, 1–80), `nameArabic` (1–80, any script text, stored as typed), `story` (1–600), `topics` (0–6 short free-text tags, up to 30 characters each, as on the imported hosts), `photo`
(Blob URL). Creator profile has `userId`; edits are scoped by it. "Complete" means photo, both names and story present.

## Notes shown to the creator

The note is the note of the **latest** `VideoStatusEvent` of the video; if that entry has no note, there is none (a dash in the
list). No new table.
