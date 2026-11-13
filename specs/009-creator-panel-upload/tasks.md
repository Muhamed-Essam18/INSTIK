---
description: "Task list for Creator Panel and Video Upload"
---

# Tasks: Creator Panel and Video Upload

**Input**: Design documents in `/specs/009-creator-panel-upload/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: Spec 8 applied (roles, invites, database content, `src/lib/content/status*.ts`, `src/lib/session.ts`).

**Tests**: Included. Constitution IX requires tests for core logic and XI requires role and ownership tests, including a creator trying to reach another creator's data. Tests live in `tests/unit/` (Vitest runs `tests/**/*.test.{ts,tsx}`), use injected in-memory stores (as `tests/unit/billing/` does) or the in-memory database helper `tests/helpers/content-db.ts`, and need no database, Mux or Blob.

**Organization**: By user story, in priority order. The shared panel frame and the shared data and Mux plumbing are in Foundational because every story needs them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5, as in spec.md
- Include exact file paths. Before writing any Next.js code read the relevant guide in `node_modules/next/dist/docs/01-app/` (server actions: `02-guides/forms.md`, `02-guides/data-security.md`; route handlers: `01-getting-started/15-route-handlers.md`), as `AGENTS.md` requires.
- Pages that read the session must render behind `<Suspense fallback={<PageFallback />}>` (as `src/app/(panel)/creator/page.tsx` does) because of `cacheComponents`.

## Phase 1: Setup

- [X] T001 Add runtime dependencies `@mux/mux-node`, `@mux/upchunk` and `@vercel/blob` to `package.json` and install; state the reason for each in the commit message (plan.md, Technical Context)
- [X] T002 [P] Add optional settings `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` and `BLOB_READ_WRITE_TOKEN` to `src/lib/env.ts` (the three Mux settings must be set together or none, like the signing pair; an empty string counts as not set) and to `.env.example` with one-line comments; add cases to `tests/unit/env.test.ts`
- [X] T003 [P] Add path helpers `creatorUploadPath()`, `creatorVideosPath(filter?)`, `creatorVideoPath(id)`, `creatorVideoEditPath(id)`, `creatorHostPath()` and `muxWebhookPath()` to `src/lib/routes.ts`, with cases in `tests/unit/routes.test.ts`
- [X] T004 [P] Raise `serverActions.bodySizeLimit` to `"3mb"` and add `images.remotePatterns` for `*.public.blob.vercel-storage.com` in `next.config.ts` (research R5)

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: the schema change, the limits and permission check, the extended state machine, the shared reads and the panel frame.

**⚠️ CRITICAL**: no user story work starts before this phase is done.

- [X] T005 Update `Video` in `prisma/schema.prisma` exactly per data-model.md: `title` default `""`; `stage` nullable `String?` (final stage, owner-set); `topic` nullable `String?`; `durationSeconds` nullable `Int?` (at least 1 and at most 1,800 once set, checked in code); `access` default `FULL`; new `proposedStage String?`, `description String?` (up to 1,000 characters, checked in code), `muxUploadId String?`, `muxAssetId String?`, `assetReadyAt DateTime?`, `submittedAt DateTime?`, `checklistAcceptedAt DateTime?`, `uploadStartedAt DateTime?`, `pendingUploadId String?`, `pendingAssetId String?`, `pendingPlaybackId String?`, `pendingDurationSeconds Int?`, `pendingReadyAt DateTime?`, `pendingStartedAt DateTime?`, `pendingFailure String?` (up to 200 characters, checked in code), `deletedAt DateTime?`; add `@@index([hostId, updatedAt])`. Create the migration with `npm run db:migrate` and regenerate the client. Leave the `VideoStatusEvent` append-only trigger untouched; extend `tests/unit/migration-append-only.test.ts` with a case that the new migration does not drop or alter it
- [X] T006 Add `src/lib/creator/store.ts` and `src/lib/mux/store.ts` to the `allowed` list in `tests/unit/dal-boundary.test.ts` (a deliberate decision, research R12) and add the new `Video` columns and a `deletedAt` filter to the in-memory helper `tests/helpers/content-db.ts` so later tests can use them. Depends on T005
- [X] T007 Extend the state machine in `src/lib/content/status.ts` (research R2): add `UPLOADING → DRAFT` to `path` and to `movesBy.system`; add `PROCESSING → IN_REVIEW` to `movesBy.creator`; export `TOO_LONG_NOTE` ("That video is longer than 30 minutes. Please upload a shorter one."); change `src/lib/content/status-service.ts` so the automatic note applies only when the caller passed none (a system `PROCESSING → DRAFT` or `UPLOADING → DRAFT` with no note gets `PROCESSING_FAILED_NOTE`). Extend `tests/unit/status-machine.test.ts` and `tests/unit/status-service.test.ts`: both new moves allowed for the right actor and refused for others, every other move unchanged, APPROVED and REJECTED still without a way out, a caller-supplied note is kept and a missing one becomes the automatic note
- [X] T008 [P] Create `src/lib/creator/limits.ts` (`MAX_UPLOAD_BYTES = 4 * 1024 ** 3`, `MAX_DURATION_SECONDS = 1800`, `UPLOAD_URL_LIFETIME_SECONDS = 3600`, `UPLOAD_GRACE_SECONDS = 900`) and `src/lib/creator/can-upload.ts` (pure `canUpload(actor)`: true for a creator, including an owner who is also a creator, false for a learner, a plain owner or no actor; research R11) with tests in `tests/unit/creator/limits-can-upload.test.ts`
- [X] T009 [P] Make learner reads safe for the new columns: in `src/lib/content/mappers.ts` skip and log (video id only) an Approved row missing `stage`, `topic` or `durationSeconds`; in `src/lib/content/index.ts` filter `deletedAt` as well as Approved. Add cases to `tests/unit/content-mappers.test.ts` and `tests/unit/content-approved-only.test.ts`: a Draft, a "Ready to submit" video, an In review video, a Changes requested video and a soft-deleted video are never visible to a learner by any path (library, search, Up next, host page, direct address)
- [X] T010 [P] Create the pure creator rules in `src/lib/creator/rules.ts` with tests in `tests/unit/creator/rules.test.ts`: `displayStatus(video, now)` and the filter and count functions per the data-model.md table (including "Upload didn't finish" when a first upload in `UPLOADING` with no asset id is older than `UPLOAD_URL_LIFETIME_SECONDS + UPLOAD_GRACE_SECONDS` (75 minutes) and the same rule for "New version didn't finish"; "Ready to submit" counted under Drafts; a Changes requested video with a pending file stays under Changes requested; Uploading and Processing only under All; soft-deleted videos excluded); `shortNote(note, 60)`; `submitProblems(details, checklist, host, upload)` returning every missing item (title 1–120, description 1–1,000, proposed stage and topic from `taxonomy.ts`, language available in `languages.json`, five checklist items ticked, complete host page, an upload started or a ready current file); `canEditDetails`, `canUploadNewVersion`, `canDelete` by status
- [X] T011 [P] Create `src/lib/mux/client.ts` (server-only, lazy Mux client from `env()`; returns null when the settings are missing) and `src/lib/mux/events.ts` with the zod schemas for the events in contracts/mux-webhook.md and a pure `planFor(event, video)` that returns what to do for the current file and for a pending file (store asset; ready with duration at least 1 and playback id; too long when duration is over 1,800; fail; ignore); tests in `tests/unit/mux/events.test.ts` for each event type, an unknown type, a missing field, a duration of exactly 1,800 and 1,801, and an id that matches neither file
- [X] T012 Extend `src/lib/content/creator-reads.ts` (every function takes the acting user, filters `deletedAt IS NULL`, and no function accepts someone else's id): `listOwnVideos` returns display fields, the flags and pending fields, `proposedStage ?? stage`, and the note of each video's **latest** history entry (none when that entry has no note), using one extra query rather than one per row; `getOwnVideo` returns the details, flags, `description` and `pendingFailure` and never the Mux ids; `getOwnProfile` returns `photo` and a `complete` flag. Add scoping tests to `tests/unit/creator-scope.test.ts` including creator B asking for creator A's video, a learner calling each function, and a soft-deleted video returning nothing
- [X] T013 Build the creator panel frame: extend `src/app/(panel)/layout.tsx` with `src/components/creator/CreatorNav.tsx` (instik creator wordmark, links Dashboard, Upload a video, My videos, My host page, the current page marked with `aria-current`, "Signed in as <name>"), matching `docs/design/CreatorUpload.dc.html`; owner pages keep the plain frame (decide by the signed-in actor's area). Targets at least 44px, visible focus, tokens only. Add `tests/unit/CreatorNav.test.tsx` and keep `tests/unit/panel-pages.test.tsx` passing

**Checkpoint**: schema, limits, machine, reads and frame are ready.

---

## Phase 3: User Story 1 - Upload a video and submit it for review (P1) 🎯 MVP

**Goal**: A creator uploads a file with visible progress, fills in the details, ticks the checklist and submits or saves a draft; the video reaches In review automatically.

**Independent Test**: As a creator, upload a sample video, fill the form, tick the checklist and submit; the video ends In review without further action (quickstart checks 3 to 6).

### Tests for User Story 1

- [X] T014 [P] [US1] Webhook service tests in `tests/unit/mux/webhook-service.test.ts` using the in-memory store: first upload asset created stores the id and moves UPLOADING → PROCESSING; ready before submit sets `assetReadyAt` and stays in PROCESSING; ready after submit moves to IN_REVIEW with the history entry credited to the creator; submit after ready moves at once; repeated and out-of-order events create one history entry; an id matching neither the current nor the pending file changes nothing; errored asset and cancelled upload go to DRAFT with the plain note; a first video over 1,800 seconds goes to DRAFT with `TOO_LONG_NOTE` and its asset is deleted; an unknown or soft-deleted video changes nothing; pending-file events (asset created, ready, errored, too long) update only the `pending*` fields and never the status, and a ready pending file with `submittedAt` set swaps in, moves CHANGES_REQUESTED → IN_REVIEW and deletes the old asset
- [X] T015 [P] [US1] Upload service tests in `tests/unit/creator/upload-service.test.ts`: `createUpload` calls `canUpload` and is refused for a learner, a plain owner, another creator's video and the wrong status; the upload is created with the site origin, a 3600-second timeout, a signed playback policy and the video id as passthrough; an expired `UPLOADING` link is moved to DRAFT before a new upload starts; double clicking creates one upload; `submitVideo` is refused when `canUpload` is false, sets the flags exactly once, assigns a unique slug from the title (numeric suffix on conflict, never changed afterwards), returns every missing item, stores only `proposedStage` (never `stage`) and is idempotent when sent twice
- [X] T016 [P] [US1] Route test in `tests/unit/mux/webhook-route.test.ts`: a bad or missing signature returns 400 and changes nothing; missing settings return 503; a valid event returns 200 with no body

### Implementation for User Story 1

- [X] T017 [US1] Implement `src/lib/mux/webhook-service.ts` (injected store; applies `planFor` through `createStatusService` from `src/lib/content/status-service.ts`; builds the creator actor from the video's host user for a completed submission; deletes over-long and replaced assets best effort; handles current and pending files per contracts/mux-webhook.md) and its Prisma side `src/lib/mux/store.ts` (server-only; every write conditional on current state; the pending swap and status move in one transaction)
- [X] T018 [US1] Implement `src/app/api/mux/webhook/route.ts` following `src/app/api/stripe/webhook/route.ts`: raw body, `webhooks.unwrap`, no response bodies, log event id and type only
- [X] T019 [US1] Implement `src/lib/creator/upload-service.ts` (injected store) and `src/lib/creator/store.ts` (Prisma, server-only, all queries scoped to the creator's own host and `deletedAt IS NULL`): create draft, create the first upload (sets `uploadStartedAt`, moves DRAFT → UPLOADING), save draft (including `proposedStage`), submit
- [X] T020 [US1] Implement the server actions `createUpload` (first-upload kind), `saveDraft` and `submitVideo` in `src/lib/creator/actions.ts` per contracts/routes-and-actions.md: zod input, `requireCreator`, `canUpload` first, plain kind messages, no Mux details in errors, no import of the database client. Do **not** add any "upload finished" action: only the webhook moves UPLOADING → PROCESSING. When Mux is not set up return a calm "uploads are not set up yet" result
- [X] T021 [P] [US1] Create `src/components/creator/UploadProgress.tsx` with `tests/unit/creator/UploadProgress.test.tsx`: drop zone (MP4 or MOV by extension and declared type), a client check that refuses a file over `MAX_UPLOAD_BYTES` before any upload starts with a plain message (test with 4 GB and 4 GB + 1 byte), `@mux/upchunk` upload from the URL the action returns, a labelled progress bar with percentage text and `aria-valuenow`, "Uploaded, processing" from the browser's own completion event, failed state with Retry, and resume after a dropped connection; progress shows within 2 seconds of choosing a file
- [X] T022 [P] [US1] Create `src/components/creator/Checklist.tsx` with the five items verbatim from `docs/design/CreatorUpload.dc.html` and the "You don't need a transcript…" note
- [X] T023 [US1] Create `src/components/creator/UploadForm.tsx` and the pages `src/app/(panel)/creator/upload/page.tsx` and `src/app/(panel)/creator/videos/[id]/edit/page.tsx` (each behind Suspense): title, stage (saved as the proposal), topic, language (only available languages), description, the progress bar, the checklist, Save draft and Submit for review; details can be typed while uploading; submit is disabled until the browser reports the upload complete; field errors are named kindly; a failed upload keeps the typed details; no transcript field; an incomplete host page blocks Submit with a link to My host page
- [X] T024 [US1] After Submit or Save draft redirect to `creatorVideoPath(id)` in `src/components/creator/UploadForm.tsx`; if any step of quickstart.md checks 3 to 6 changed while building, update `specs/009-creator-panel-upload/quickstart.md`

**Checkpoint**: a creator can upload, fill in, save a draft, submit, and the video reaches In review. MVP.

---

## Phase 4: User Story 2 - My videos (P1)

**Goal**: A creator sees every video with status, latest note, views slot and update date, and filters with correct counts.

**Independent Test**: With videos in several statuses open My videos, check rows and counts and switch each filter.

- [X] T025 [P] [US2] Component tests in `tests/unit/creator/VideoTable.test.tsx`: rows, shortened note or a dash, views slot dash unless live (placeholder for live), counts equal the rows of each filter, "Ready to submit" under Drafts, a pending new version under Changes requested, Rejected only under All, soft-deleted videos absent, empty state links to Upload a video, the list simply ends (no pagination or infinite scroll)
- [X] T026 [P] [US2] Create `src/components/creator/StatusBadge.tsx`, `StatusFilters.tsx` (links with `?status=`, counts, `aria-current`) and `VideoTable.tsx` per `docs/design/CreatorVideos.dc.html`; each row opens the status page; proper table headers; works at phone width
- [X] T027 [US2] Create `src/app/(panel)/creator/videos/page.tsx` (reads `searchParams`, validates the filter, newest update first, uses `listOwnVideos`, behind Suspense) with a calm empty state

**Checkpoint**: US1 and US2 work together.

---

## Phase 5: User Story 3 - Read Instik's note and send a new version (P2)

**Goal**: The status page shows the note, the history and the right actions; a new version is uploaded as a pending file and resubmitted.

**Independent Test**: Put a video in Changes requested with a note, open it as its creator, upload a new version, re-tick the checklist and submit (quickstart checks 7 to 9).

- [X] T028 [P] [US3] Tests in `tests/unit/creator/version-flow.test.ts`: from CHANGES_REQUESTED a new upload fills `pendingUploadId` and `pendingStartedAt`, clears `pendingFailure`, and never changes the status; the video stays in Changes requested with the note visible while the pending file processes and when it is ready; a submit with the pending file not ready sets `submittedAt` and completes on ready; a submit with it ready swaps it in (current ids, playback id, duration and `assetReadyAt` take the pending values, `pending*` cleared), moves to IN_REVIEW and deletes the old Mux asset; a details-only submit with no pending file moves at once; a failed or over-long pending file keeps the earlier file and status, sets `pendingFailure` and clears `submittedAt`; a Rejected or Approved video offers no upload, edit or delete; `deleteDraft` works only for a Draft, sets `deletedAt`, deletes the Mux assets, keeps every history row and hides the video from every read; another creator's video is not found for every action
- [X] T029 [US3] Extend `src/lib/creator/upload-service.ts`, `src/lib/creator/store.ts` and `src/lib/creator/actions.ts` with the `newVersion` kind of `createUpload`, the pending-file submit and swap, and `deleteDraft` as a soft delete (delete Mux assets first, then in one update set `deletedAt` and reset `slug` to `draft-<id>` so a slug assigned at an earlier submit is freed; never delete rows; confirmation is handled in the UI). Add a case to T028 that a deleted draft's slug is free for a new video
- [X] T030 [P] [US3] Create `src/components/creator/HistoryList.tsx` (newest first; each step with date, "You" or "Instik", and the note; creator-side wording "Submitted" for the move into review and "Uploaded" for UPLOADING, per `docs/design/CreatorVideo.dc.html`) and `VersionUpload.tsx` (reuses `UploadProgress` and `Checklist`; shows "New version processing", "New version ready to submit", "New version didn't finish" and the `pendingFailure` message)
- [X] T031 [US3] Create `src/app/(panel)/creator/videos/[id]/page.tsx` behind Suspense: title, proposed stage (or final), topic, length (skip the preview and the length when the duration is null, never pass a null to `signPlaybackTokens`), display status, signed-playback preview via `signPlaybackTokens` (calm placeholder when there is no playback id yet), the latest entry's note, the history, actions by status (Upload a new version and Edit details for Changes requested; Edit and Delete for Draft and Ready to submit; nothing for In review, Approved and Rejected), the statistics placeholder; another creator's id and a soft-deleted id render the not-found page

**Checkpoint**: the review loop is closed from the creator side.

---

## Phase 6: User Story 4 - Panel layout and Dashboard placeholder (P2)

**Goal**: The panel matches the designs and the Dashboard is a friendly empty page.

**Independent Test**: Sign in as a creator, open each nav item, confirm the marked current page and the Dashboard text; as a learner every creator URL is not found.

- [X] T032 [US4] Replace the placeholder in `src/components/screens/CreatorScreen.tsx` with the empty Dashboard: statistics will appear once videos are live, with a link to Upload a video; keep `requireCreator`
- [X] T033 [P] [US4] Tests in `tests/unit/creator/access.test.ts`: a learner and a signed-out visitor are turned away from every creator page and action; an owner who is also a creator reaches both areas (as in spec 8); the nav marks the current page
- [ ] T034 [US4] Check the layout against the three designs at desktop and phone widths and fix spacing, focus and contrast to the tokens (no hard-coded colours)

---

## Phase 7: User Story 5 - Edit my host page (P3)

**Goal**: A creator edits photo, Latin and Arabic names, short story and topics, and learners see the changes.

**Independent Test**: Change each field, save, open the public host page (quickstart check 2).

- [X] T035 [P] [US5] Tests in `tests/unit/creator/host-rules.test.ts`: Latin name 1–80, Arabic name 1–80 stored as typed (tashkeel kept), story 1–600, topics 0–6 free-text tags of up to 30 characters; photo accepted only when the first bytes are JPEG, PNG or WebP (the declared type is not trusted) and at most 2 MB; a creator edits only their own host; an owner or learner is refused
- [X] T036 [US5] Implement `src/lib/creator/host-rules.ts` (pure validation and magic-byte check) and `src/lib/creator/photo-store.ts` (Vercel Blob `put` under `host-photos/<hostId>/<random>.<ext>`, delete the old photo after the save, behind an interface for tests)
- [X] T037 [US5] Add `saveHost` and `uploadHostPhoto` actions to `src/lib/creator/actions.ts` and revalidate the learner host page and any page showing the host's name
- [X] T038 [P] [US5] Create `src/components/creator/HostForm.tsx` and `PhotoField.tsx` and the page `src/app/(panel)/creator/host/page.tsx` (behind Suspense): Arabic name input with `dir="rtl"` `lang="arz"`, kind messages for a wrong type or size, the old photo kept on failure
- [X] T039 [US5] Confirm the public host page shows the changes (Arabic name right-to-left) and that Submit for review reflects the completeness rule (T010, T023); keep `tests/unit/creator-host-page.test.tsx` passing

---

## Phase 8: Polish and cross-cutting

- [X] T040 [P] Copy pass over every new screen against the brand voice (short, warm, honest, never shaming; no internal level names) and `docs/design/` strings
- [ ] T041 [P] Accessibility pass: labelled controls, `aria-live` for upload progress and form errors, keyboard-only walk through Upload, My videos, status page and host form
- [X] T042 Security review: webhook verifies before any parsing; no Mux ids, tokens or secrets reach the client; every action and read takes the acting creator; no endpoint returns another creator's data; logs carry ids only; no action lets the browser move a status the webhook owns
- [ ] T043 Ask Mux (support or the dashboard limits page) for the maximum direct-upload file size and confirm 4 GB is within it; record the answer in `specs/009-creator-panel-upload/research.md` R1 and adjust `MAX_UPLOAD_BYTES` if needed
- [X] T044 Add a short note to the Spec 10 section of `docs/build-specs.md` that owner reads must filter `deletedAt`, `canUpload` in `src/lib/creator/can-upload.ts` gains "not paused", and `stage` is pre-filled from `proposedStage`
- [ ] T045 Update `docs/build-specs.md` (spec 9 status) and run quickstart.md checks 1 to 9 against a real Mux test environment through a tunnel; record any deviations. SC-001, SC-003 and SC-007 are post-launch checks with real creators and are not part of this task
- [X] T046 Run `npm run lint && npm run typecheck && npm test && npm run build` and fix everything they report

---

## Dependencies & Execution Order

- Phase 1 first. Within it T002, T003 and T004 are independent.
- Phase 2 needs Phase 1. T005 (schema) blocks T006, T009, T012 and every store. T006 blocks tests that use the in-memory helper. T007, T008, T010 and T011 are independent of each other. T013 needs T003.
- US1 needs Phase 2. Tests T014 to T016 are written first and fail. T017 → T018; T019 → T020 → T023; T021 and T022 are parallel to the services.
- US2 needs Phase 2 and T012; it shows US1's videos but is testable with seeded rows.
- US3 needs US1's upload components (T021, T022) and service (T019).
- US4 needs only Phase 2; T032 can be done any time after T013.
- US5 needs Phase 2 only; T039 also depends on T023 for the completeness block.
- Polish last; T043 can be done at any time and should be done before launch.

### Parallel opportunities

- Phase 1: T002, T003, T004.
- Phase 2: T007, T008, T009, T010, T011 (after T005 where they touch the schema).
- US1: T014, T015, T016 together; then T021 and T022 together.
- After Phase 2, US2, US4 and US5 can be built in parallel by different people.

```text
# US1 tests together
Task: "Webhook service tests in tests/unit/mux/webhook-service.test.ts"
Task: "Upload service tests in tests/unit/creator/upload-service.test.ts"
Task: "Route test in tests/unit/mux/webhook-route.test.ts"
```

## Implementation Strategy

### MVP first

1. Phases 1 and 2.
2. Phase 3 (US1): upload, save draft, submit, automatic move to In review.
3. Stop and validate with quickstart checks 3 to 6 against a real Mux test environment.

### Incremental delivery

1. Add US2 (My videos) so creators can see what they uploaded.
2. Add US3 (status page, pending new version, soft delete), ready for spec 10's review screens.
3. Add US4 (Dashboard placeholder and layout polish) and US5 (host page).
4. Polish and the full quickstart.

## Notes

- Spec 10 reuses `src/lib/content/status.ts` and `status-service.ts`; do not add a second machine.
- Video files never pass through our server; only photos (2 MB) do.
- Status history is append-only (database trigger from spec 8); nothing in this spec deletes a history row.
- Commit after each task or small group; keep each change reviewable.
