# Implementation Plan: Creator Panel and Video Upload

**Branch**: `009-creator-panel-upload` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-creator-panel-upload/spec.md`

## Summary

Turn the empty creator area from spec 8 into the creator panel: layout and navigation, Upload a video, My videos, the
video status page and My host page. Video files go from the browser straight to Mux using a one-time direct-upload URL
created by a server action for the signed-in creator. A verified Mux webhook moves the video from Uploading to
Processing to In review and records the duration. All status changes keep going through the pure state machine and
transactional service that spec 8 already built (`src/lib/content/status.ts`, `status-service.ts`); this spec extends
them slightly and spec 10 reuses them. Host photos go to Vercel Blob with size and type limits.

Findings that shaped the plan:

- The state machine and the history store already exist (spec 8). This spec adds two moves and two flags rather than a
  second machine: `UPLOADING → DRAFT` (first upload failed or expired), creator `PROCESSING → IN_REVIEW` (the creator's
  submission completes it), and the `submittedAt` / `assetReadyAt` flags that let a submission wait for processing (FR-021).
- A video stays in `PROCESSING` while its asset is ready but the creator has not yet submitted; the page shows "Ready to
  submit". Adding a "ready" status would change the shared path and the learner-facing rules for no gain.
- A new version never changes the status. While in Changes requested the new file lives in `pending*` fields; on resubmit it
  replaces the current file and the old Mux asset is deleted. Approved videos have no way back, so new versions of Approved
  videos do not exist in this spec.
- Constitution VIII says the owner sets the stage. The creator's choice is stored as `proposedStage`; `stage` stays owner-set
  (spec 10 pre-fills it from the proposal). No constitution change.
- Deleting a draft is a soft delete (`deletedAt`): spec 8's database trigger makes status history append-only, so the row and its
  history must stay. Every read filters deleted rows; spec 10's owner reads must too.
- `Video` today requires stage, topic, duration and a slug at creation. Drafts have none of these, so those columns become
  nullable (or generated) and learner reads, which only ever see Approved videos, skip and log a malformed row.
- Photos are small, so they may pass through the server (the "never through our server" rule in constitution XIII is for
  video files only).
- Uploads are creator-only in this spec (owners do not upload; XIII allows an owner to request a link, which nothing needs yet).
  Both `createUpload` and `submitVideo` go through one `canUpload(actor)` check that spec 10 extends with "not paused" (XI, XIII).
- Only the verified Mux webhook moves a first upload to Processing; there is no client "upload finished" action.
- Limits: 4 GB checked in the browser, 30 minutes checked on the server when the asset is ready. Mux documents no byte limit for
  direct uploads, so confirm it with Mux before launch.

## Technical Context

**Language/Version**: TypeScript (strict), Node 24, Next.js 16.4.5 App Router with `cacheComponents`, React 19.3

**Primary Dependencies**: existing: Prisma 7, Auth.js v5, zod 4, `@mux/mux-player-react`. New runtime dependencies, each with a reason:
`@mux/mux-node` (create direct uploads, read assets, delete a replaced asset, verify webhook signatures with `webhooks.unwrap`);
`@mux/upchunk` (browser uploader with progress, chunk retry and pause/resume, with no UI of its own so the progress bar matches
the design tokens; chosen over the Mux uploader web component for that reason); `@vercel/blob` (host photos).

**Storage**: PostgreSQL (new columns on `Video`, `Host` unchanged); Mux for video files; Vercel Blob (public store) for host photos.

**Testing**: Vitest. Pure and injected-store tests, as in specs 7 and 8: state machine additions, webhook event parsing and
handler (in-memory store, repeated and out-of-order events), upload and submit rules, photo validation, creator read scoping.
The real Mux and Blob calls are behind small interfaces and covered by the manual run in [quickstart.md](quickstart.md).

**Target Platform**: Vercel (Node runtime) with managed Postgres

**Project Type**: Single Next.js web application

**Performance Goals**: Progress visible within 2 seconds of choosing a file (SC-002); My videos is one query for videos and one
for latest notes; a host page edit is visible within a minute (SC-008).

**Constraints**: Video bytes never reach our server; the webhook verifies its signature on the raw body before anything else;
all role and ownership checks live in the Data Access Layer; build and tests need no secrets; Mux and Blob settings are optional
so the app still builds and the rest of the site works without them (the upload page then shows a calm "uploads are not set up" note).

**Scale/Scope**: Handful of creators, tens of videos each; MP4/MOV files up to 4 GB and 30 minutes (one constants module,
`src/lib/creator/limits.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
| --- | --- | --- |
| I. Product source of truth | Pass | Screens 9–12 and the host page; designs `CreatorUpload`, `CreatorVideos`, `CreatorVideo` |
| II. Brand behaviours | Pass | My videos ends (no infinite scroll); calm, kind copy; no shaming error text |
| III. Honest hours | N/A | No watch tracking touched |
| IV. Multi-language | Pass | Language comes from `content/languages.json`, only available ones selectable; Arabic name has `dir="rtl"` `lang="arz"` |
| V. Arabic first-class | Pass | Arabic name stored as typed (tashkeel kept), shown with the Arabic fonts |
| VI. Design fidelity | Pass | Built from the three designs and tokens; 44px targets; progress bar is a labelled `progress`/`role="progressbar"` |
| VII. Stack discipline | Pass | Mux, Vercel; three new dependencies each justified above; Next.js docs read for server actions, route handlers and forms |
| VIII. Content in the database, published by review | Pass | Creator changes only their own non-Approved videos; the creator's stage goes to a separate `proposedStage`, and `stage` is only ever set by the owner; no transcript field; only Approved, non-deleted videos reach learners; status history stays append-only (soft delete) |
| IX. Quality and small changes | Pass | Tests listed above; lint, type-check, build gate |
| X. Privacy and security | Pass | Inputs validated with zod; webhook signature verified; photo type and size checked; secrets server-only |
| XI. Roles and permissions | Pass | Every read/write takes the acting creator inside the Data Access Layer (new stores added to the DAL boundary list on purpose); another creator's video is "not found"; one `canUpload(actor)` check that spec 10 extends for pausing; tests cover it |
| XII. Money | N/A | |
| XIII. Direct video upload | Pass | One-time upload URL for the signed-in, invited creator's own video (creator-only in this spec; owners do not upload); readiness and processing only via the verified webhook; signed playback policy |

No violations; Complexity Tracking not needed. Re-checked after Phase 1: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/009-creator-panel-upload/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes-and-actions.md
│   └── mux-webhook.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                       # Video: description, mux ids, flags; nullable draft columns (one migration)

src/app/
├── (panel)/
│   ├── layout.tsx                      # extended: creator nav + "Signed in as" (owner pages keep a plain frame)
│   └── creator/
│       ├── page.tsx                    # Dashboard placeholder (exists, restyled)
│       ├── upload/page.tsx             # Upload a video (new draft) 
│       ├── videos/page.tsx             # My videos
│       ├── videos/[id]/page.tsx        # Video status page
│       ├── videos/[id]/edit/page.tsx   # Edit details / continue a draft
│       └── host/page.tsx               # My host page
└── api/mux/webhook/route.ts            # POST, signature verified

src/components/creator/
├── CreatorNav.tsx  UploadForm.tsx  UploadProgress.tsx  Checklist.tsx
├── VideoTable.tsx  StatusFilters.tsx  StatusBadge.tsx  HistoryList.tsx
├── VersionUpload.tsx  HostForm.tsx  PhotoField.tsx

src/lib/creator/                        # new
├── actions.ts          # server actions: createUpload, saveDraft, submitVideo, deleteDraft, saveHost, uploadHostPhoto
├── can-upload.ts       # pure: the one "may this person upload or submit" check (spec 10 adds pause)
├── limits.ts           # MAX_UPLOAD_BYTES, MAX_DURATION_SECONDS, upload link lifetime and grace
├── rules.ts            # pure: submit requirements, checklist, filters and counts, display status
├── upload-service.ts   # injected-store service: create upload, submit, swap pending file, soft delete
├── host-rules.ts       # pure: host form validation, photo limits and magic-byte check
├── photo-store.ts      # Vercel Blob put/delete behind an interface
└── store.ts            # Prisma side (server-only; added to the DAL boundary list)

src/lib/mux/                            # new
├── client.ts           # lazy Mux client from env (server-only)
├── events.ts           # zod schemas for the webhook events we use + pure mapper to a "what to do"
├── webhook-service.ts  # injected-store handler: apply an event idempotently via the status service
└── store.ts            # Prisma side (server-only; added to the DAL boundary list)

src/lib/content/
├── status.ts           # extended moves (see research R2)
├── status-service.ts   # automatic note only when the caller passed none
├── creator-reads.ts    # extended: notes, filters, host profile with photo, draft fields; filters deletedAt
├── index.ts            # learner reads also filter deletedAt
└── mappers.ts          # learner mapping skips and logs Approved rows missing stage, topic, duration

tests/unit/…            # one file per new module above; existing flat files extended (status-machine, status-service, creator-scope, dal-boundary, content-approved-only, content-mappers)
tests/helpers/content-db.ts   # in-memory database gains the new columns
```

**Structure Decision**: Extend the single app with a `creator` data-access area and a small `mux` integration area. Both
follow the injected-store pattern from billing and spec 8 so logic is tested without a database or Mux.

## Complexity Tracking

None.
