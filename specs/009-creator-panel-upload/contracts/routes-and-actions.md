# Contract: Routes and server actions

All pages and actions run the creator check first (`requireCreator` / `getActor` in the Data Access Layer). A learner, or a
creator reaching another creator's video, gets the not-found page. Actions validate input with zod and return a plain result
(`{ ok: true }` or `{ ok: false, message, fields? }`); messages follow the brand voice. Server actions never import the database
client: they call the stores in the Data Access Layer.

## Pages (creator only)

| Path | Purpose |
| --- | --- |
| `/creator` | Dashboard placeholder |
| `/creator/upload` | Start a new video (creates the draft on first file or first save) |
| `/creator/videos` | My videos, `?status=in-review|changes|live|drafts` (default all) |
| `/creator/videos/[id]` | Status page: note, preview, history, new version, edit, delete (draft) |
| `/creator/videos/[id]/edit` | Continue a draft or edit details (Draft, Changes requested) |
| `/creator/host` | My host page |

## Actions (`src/lib/creator/actions.ts`)

| Action | Input | Does | Fails with |
| --- | --- | --- | --- |
| `createUpload` | `{ videoId?, kind: "first" \| "newVersion" }` | `canUpload` check; creates the draft if no id; for `first` moves DRAFT → UPLOADING (an expired UPLOADING link is first moved to DRAFT by the system); for `newVersion` (only in CHANGES_REQUESTED) stores the pending upload and clears `pendingFailure`; creates the Mux upload; returns `{ videoId, uploadUrl }` | not set up, not allowed, wrong status, not owner |
| `saveDraft` | details | Saves any filled fields (including `proposedStage`); no status change | too long fields |
| `submitVideo` | details + five checklist items + `videoId` | `canUpload` check; validates (see data model); sets `submittedAt`, `checklistAcceptedAt`; assigns the slug on first submit; moves to IN_REVIEW now or when the asset is ready (swapping in a pending file where there is one) | each missing item named |
| `deleteDraft` | `{ videoId }` | Soft delete (`deletedAt`) and delete the Mux assets (current and pending) | not a draft |
| `saveHost` | name, Arabic name, story, topics | Updates own host | invalid fields |
| `uploadHostPhoto` | file (form data) | Checks type and size, stores in Blob, updates `Host.photo`, deletes old photo | too big, wrong type |

There is no action that reports an upload as finished: the verified Mux webhook is the only thing that moves UPLOADING → PROCESSING
or marks a file ready. The page shows "Uploaded, processing" from the browser's own upload-complete event.

## Reads (`creator-reads.ts`, all take the actor, all filter `deletedAt IS NULL`)

`listOwnVideos` (with the latest entry's note, display status, counts), `getOwnVideo` (details and flags), `listStatusHistory`
(existing), `getOwnProfile` (with photo and completeness). No function accepts a creator id or a status of someone else.

## Upload limits (`src/lib/creator/limits.ts`)

File type MP4 or MOV (checked by the browser's declared type and extension before the upload starts; Mux validates the real
file and reports `asset.errored` otherwise). Files over `MAX_UPLOAD_BYTES` (4 GB) are refused in the browser before the upload
starts. Upload URL lifetime 1 hour. Videos longer than `MAX_DURATION_SECONDS` (30 minutes) are refused after processing (see webhook contract).
