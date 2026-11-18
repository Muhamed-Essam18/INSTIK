---
description: "Task list for Owner Panel: Review, Transcripts and Creators"
---

# Tasks: Owner Panel: Review, Transcripts and Creators

**Input**: Design documents in `/specs/010-owner-panel-review/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: Specs 8 and 9 applied (roles, invites, status service, creator panel, Mux webhook, `src/lib/session.ts`).

**Tests**: Included. Constitution IX asks for tests of core logic and XI for role tests, including a creator trying every owner action. Tests live in `tests/unit/` and use the in-memory store pattern (`createXService({ store, ... })`).

**Organization**: By user story in priority order. The schema, the pause flag on the actor, the pure rules and the owner navigation are Foundational because every story needs them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5, as in spec.md
- Before writing Next.js code read the relevant guide in `node_modules/next/dist/docs/01-app/` (server actions: `02-guides/forms.md` and `02-guides/data-security.md`; pages and layouts: `01-getting-started/03-layouts-and-pages.md`).
- Pages that read the session render behind `<Suspense fallback={<PageFallback />}>` (as `src/components/screens/OwnerCreatorsScreen.tsx` is used) because of `cacheComponents`.
- Store files (`store.ts`) are the only place Prisma is queried: add each new one to the `allowed` list in `tests/unit/dal-boundary.test.ts`.

## Phase 1: Setup

- [X] T001 [P] Add path helpers `ownerReviewVideoPath(id)` (`/owner/review/<id>`), `ownerWaitingPath()` (`/owner/waiting`) and `ownerCreatorPath(id)` (`/owner/creators/<id>`) to `src/lib/routes.ts`; `ownerPath()` stays the Review queue. Add cases to the routes test in `tests/unit/`.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: schema, pause on the actor, pure rules, store wiring pattern, owner navigation.

**⚠️ CRITICAL**: no user story work starts before this phase is done.

- [X] T003 Update `prisma/schema.prisma` exactly per data-model.md: `User.pausedAt DateTime?`; new enum `PauseKind { PAUSED RESUMED }` and model `CreatorPauseEvent` (`id` cuid, `userId` with relation `"PausedCreator"` cascading on delete, `kind`, `actorId String?` with relation `"PauseActor"` set null on delete, `actorLabel String`, `createdAt`, index `(userId, createdAt)`); and the two back-fields on `User`: `pauseEvents CreatorPauseEvent[] @relation("PausedCreator")` and `pausesMade CreatorPauseEvent[] @relation("PauseActor")` (both relations must be named because `CreatorPauseEvent` links to `User` twice); `Video.reviewChecks Json @default("{}")`; `TranscriptSegment.revision Int @default(0)`; enum `EmailOutcome { SENT FAILED }` and model `DecisionEmail` (`id` cuid, `eventId String @unique`, `toEmail`, `outcome`, `failure String?` at most 200 characters (checked in code), `createdAt`).
- [X] T004 Create the migration with `npm run db:migrate -- --name owner_review`; edit `prisma/migrations/<timestamp>_owner_review/migration.sql` to add a trigger refusing UPDATE and DELETE on `"CreatorPauseEvent"`, copying the style of the trigger in `prisma/migrations/20261111120000_creator_content/migration.sql`. Run `npx prisma generate`.
- [X] T005 [P] Create `src/lib/review/rules.ts` (pure): the five checklist items (`stageFits`, `audio`, `realPeople`, `safe`, `transcript`) with their design copy from `docs/design/OwnerReview.dc.html`; `parseChecks(json)` (zod, missing keys false); `allTicked`; `approveProblems({ status, checks, segmentCount, stage, title, topic, durationSeconds, playbackId })` returning named problems (checklist, no-transcript, not-ready, no-stage, not-in-review); `queueBadge(segmentCount)` ("Needs review" or "Transcript in progress"); `daysWaiting(from, now)` ("Today", "1 day", "4 days"), and `startOfMonth(now)` returning the first instant of the current month in the Europe/Warsaw time zone (shared by the queue counts and creator stats; spec 11 earnings months will reuse it).
- [X] T006 [P] Create tests `tests/unit/review/rules.test.ts` for T005: every missing piece is named and refused, all ticked plus a segment passes, badges, days waiting boundaries (same day, 1, many), `startOfMonth` at a winter month end and a summer (daylight saving) month end and at the exact Warsaw midnight, `parseChecks` on `{}` and on garbage.
- [X] T007 Extend `Actor` in `src/lib/roles/actor.ts` with `paused?: boolean`; in `src/lib/session.ts` `getActor` select `pausedAt` with `role` and set `paused` (read fresh each request, as the role is). Update `src/lib/creator/can-upload.ts` so a creator with `paused === true` is refused (an owner who is also a paused creator is refused creator writes too); fix its doc comment. In `src/lib/creator/host-service.ts` replace the `hasRole(actor, "creator")` checks in `saveHost` and `uploadPhoto` with `canUpload(actor)` so a paused creator cannot edit their host page (reading it stays allowed).
- [X] T008 [P] Create tests `tests/unit/creator/pause-access.test.ts`: `canUpload` false for a paused creator, true for an active one, false for learner and owner-only; and a test that each creator write returns `not-allowed` for a paused creator and works for an active one: in `src/lib/creator/upload-service.ts` `createUpload` (first upload and new version), `saveDraft`, `submitVideo` and `deleteDraft` (the four functions it returns), and in `src/lib/creator/host-service.ts` `saveHost` and `uploadPhoto`, using `tests/helpers/upload-memory.ts` and the in-memory store from `tests/unit/creator/host-service.test.ts`. Reading the host page and My videos stays allowed.
- [X] T009 Make resubmission clear the checklist: in `src/lib/creator/store.ts` where the pending file is swapped in and the submission is marked (`swapPending` / `markSubmitted`), also set `reviewChecks` to `{}` when a video returns to review from Changes requested; extend `tests/helpers/upload-memory.ts` and `tests/unit/creator/version-flow.test.ts` to assert the checklist is cleared and segments are kept.
- [X] T010 [P] Create the owner navigation: `src/components/owner/OwnerNav.tsx` (Review queue, Creators, Learner site link; current page marked with `aria-current="page"`; 44px targets; tokens only; no Earnings link) and `src/app/(panel)/owner/layout.tsx` that renders it beside `children`, following `src/components/creator/CreatorNav.tsx` and `src/app/(creator)/creator/layout.tsx`. Add `tests/unit/OwnerNav.test.tsx` modelled on `tests/unit/CreatorNav.test.tsx`.
- [X] T011 [P] Create `tests/helpers/review-memory.ts`: an in-memory `ReviewStore` (videos, segments with revisions, history events, glossary entries, decision emails, with a transaction that rolls back on throw and a row lock that serialises two callers) for the review service tests.

**Checkpoint**: migration applied, `npm run typecheck` and `npm test` green.

---

## Phase 3: User Story 1 - Work through the review queue (Priority: P1) 🎯 MVP

**Goal**: `/owner` shows the four counts and the oldest-first table, owner only; the Waiting on creator count opens a read-only list of Changes requested videos.

**Independent Test**: With videos In review (with and without segments), Changes requested and Approved this month, open `/owner`: counts, order, badges and buttons match; a learner and a creator get not-found; a signed-out visitor is sent to sign in.

### Tests for User Story 1

- [X] T012 [P] [US1] Create `tests/unit/review/queue.test.ts`: `getQueue(actor, { list: "waiting" })` returns the Changes requested videos oldest first (by their newest CHANGES_REQUESTED history entry), and `getQueue(actor, { list: "review" })` returns oldest submission first (the newest IN_REVIEW history entry is the submission date, not `submittedAt`), badge by segment count, counts (Needs review, Transcript in progress, Waiting on creator = CHANGES_REQUESTED, Approved this month = APPROVED history entries since `startOfMonth` in the Europe/Warsaw time zone, with a boundary test: an approval at 23:30 UTC on 31 January is already 1 February in Warsaw and counts for February, and an approval at 22:30 UTC on 31 July is already 1 August in Warsaw (summer time) and counts for August), soft-deleted videos excluded, a creator and a learner calling it get `ForbiddenError`.
- [X] T013 [P] [US1] Create `tests/unit/review/QueueTable.test.tsx`: the Waiting on creator card links to `/owner/waiting`, rows, "Review" versus "Continue" labels, empty state "Nothing waiting" with counts still shown, no infinite scroll or "load more".

### Implementation for User Story 1

- [X] T014 [US1] Create `src/lib/review/store.ts` (Prisma; `import "server-only"`) with the queue queries: IN_REVIEW videos with host name, proposed stage, duration, segment count and newest IN_REVIEW event time; the three other counts, and the Changes requested list (rows ordered by their newest CHANGES_REQUESTED history entry). Add it to the allowed list in `tests/unit/dal-boundary.test.ts`.
- [X] T015 [US1] Create `src/lib/review/service.ts` with `createReviewService({ store, ... })` and `getQueue(actor, { list })` (`review` or `waiting`): owner-only (`ForbiddenError` otherwise), uses `queueBadge` and `daysWaiting`; create `src/lib/review/instance.ts` wiring it per call.
- [X] T016 [P] [US1] Create `src/components/owner/QueueCounts.tsx` and `src/components/owner/QueueTable.tsx` from `docs/design/OwnerReviewQueue.dc.html` (four count cards; table with Video, Creator, Stage, Length, Submitted, Waiting, Status, action; badge colours from tokens; horizontal scroll wrapper for narrow screens; stage shown as the learner label).
- [X] T017 [US1] Create `src/components/screens/OwnerQueueScreen.tsx` (calls `requireOwner(ownerPath())`, then `getQueue`) and replace `src/components/screens/OwnerScreen.tsx` and `src/app/(panel)/owner/page.tsx` with it behind Suspense; remove the placeholder copy. Create `src/app/(panel)/owner/waiting/page.tsx` and `src/components/screens/OwnerWaitingScreen.tsx` showing the Changes requested list with the same `QueueTable` (button label "View"), and make the Waiting on creator card in `QueueCounts.tsx` a link to `ownerWaitingPath()` (accessible name, 44px target). In `tests/unit/panel-pages.test.tsx` replace the `OwnerScreen` row with `OwnerQueueScreen` (mock `@/lib/review/instance`) and add `OwnerWaitingScreen` (owner only; everyone else turned away).

**Checkpoint**: US1 works alone; the queue lists videos even though the review screen is not built yet.

---

## Phase 4: User Story 2 - Review a video and write its transcript (Priority: P1)

**Goal**: the review screen plays the video, saves checklist, stage, access and an autosaving transcript, imports .vtt and manages glossary entries.

**Independent Test**: follow quickstart steps 3 to 5 and 12: tick items, change stage and access, add and import segments, add a word to the glossary, reload and find everything saved; two owners editing one segment get a conflict message.

### Tests for User Story 2

- [X] T018 [P] [US2] Create `tests/unit/review/segments.test.ts` for the pure module T021: start before end, no overlap, within duration, script required, ordering and position renumbering by start time, VTT cues to segments (multi-line cues joined with a space, tags stripped, text into the Arabic field), Add versus Replace counts, malformed file refused with line numbers.
- [X] T019 [P] [US2] Create `tests/unit/review/transcript-service.test.ts` against `tests/helpers/review-memory.ts`: `saveSegment` create and update (revision bumps), a stale revision returns `conflict` and changes nothing, `deleteSegment` conflict, overlap refused, import Add and Replace are all-or-nothing, nothing saves when the video is not In review, `setChecklist` and `setClassification` (stage must be a taxonomy slug, access `FREE` or `FULL`), every write is refused for a video in Changes requested, and a creator and a learner are refused on every function.
- [X] T020 [P] [US2] Create `tests/unit/review/glossary.test.ts`: matched words marked using `linkWords`, an unlinked word can be added (generated unique `entryKey`), a word whose tashkeel-stripped key already exists is refused with the existing entry returned, correcting changes only transliteration and English, a creator is refused.
- [X] T021 [P] [US2] Create `tests/unit/review/ReviewScreen.test.tsx`: the checklist items from the design, final stage pre-filled from the proposed stage, "Saved" and "Not saved yet" indicator, a conflict message with a reload button, Arabic inputs carry `dir="rtl"` and `lang="arz"`, all controls labelled and 44px; the no-tashkeel reminder shows for a bare script, goes away when tashkeel is present, and never blocks saving.

### Implementation for User Story 2

- [X] T022 [US2] Create `src/lib/review/segments.ts` (pure): `validateSegment`, `orderSegments`, `renumber`, `cuesToSegments(cues)` reusing `parseVtt` from `src/lib/content/vtt.ts`, `mergeImport(existing, incoming, mode)`; limits: segment text at most 1,000 characters per field, at most 2,000 segments per video, VTT text at most 1 MB (checked in code, quoted in the action's zod schema).
- [X] T023 [US2] Extend `src/lib/review/store.ts` and `service.ts`: `getReview(actor, videoId)` (details, checks, stage, access, segments with revisions, history, signed playback inputs), `setChecklist`, `setClassification`, `saveSegment`, `deleteSegment`, `previewVtt`, `importVtt`. Each write runs in a transaction that locks the video row (`SELECT ... FOR UPDATE` through `$queryRaw`), re-checks status is IN_REVIEW, validates with T022, renumbers `position` with a two-step update (shift to negative, then final values) because of `@@unique([videoId, position])`, and bumps `revision`. `getReview` must exclude soft-deleted videos and treat a video that is not IN_REVIEW or CHANGES_REQUESTED as not found; CHANGES_REQUESTED is read-only: every review write (`setChecklist`, `setClassification`, `saveSegment`, `deleteSegment`, `importVtt`, glossary writes, `decide`) is refused for it, with a test in T019.
- [X] T024 [US2] Create `src/lib/review/glossary.ts` and extend the store: `markLinked(script, language)` using `buildGlossaryIndex` and `linkWords` from `src/lib/content/glossary-link.ts`; `addGlossaryEntry` (generated `entryKey`, refuse existing key and return the entry), `updateGlossaryEntry` (transliteration and English only). No delete.
- [X] T025 [US2] Create `src/lib/review/messages.ts` (kind, plain copy for every refusal reason in contracts/routes-and-actions.md) and `src/lib/review/actions.ts` (`"use server"`): `setChecklist`, `setClassification`, `saveSegment`, `deleteSegment`, `previewVtt`, `importVtt`, `addGlossaryEntry`, `updateGlossaryEntry`; each calls `requireOwner` first, parses input with zod and returns the shapes in contracts/routes-and-actions.md.
- [X] T026 [P] [US2] Create `src/components/owner/ReviewChecklist.tsx` and `src/components/owner/FinalClassification.tsx` (client; checkbox and select controls from `docs/design/OwnerReview.dc.html`; saving on change with an inline status; copy "Instik decides" under Access).
- [X] T027 [P] [US2] Create `src/components/owner/TranscriptEditor.tsx`, `SegmentRow.tsx`, `VttImport.tsx` and `WordPanel.tsx` (client): time fields as m:ss, Arabic input in Noto Naskh Arabic at the design size, transliteration and English inputs, per-segment autosave when valid with a "Saved" or "Not saved yet" indicator and plain error text, conflict handling with reload of that segment, Add segment, import dialog (file picker, summary of count and problems, choose Add or Replace), word panel showing linked entries or an "Add to glossary" form, and a gentle, non-blocking note under the Arabic field when the text has no tashkeel ("Add the vowel marks if you can. Learners rely on them.", compared with `stripTashkeel` from `src/lib/text/normalize.ts`); the segment still saves.
- [X] T028 [US2] Create `src/components/screens/OwnerReviewScreen.tsx` and `src/app/(panel)/owner/review/[id]/page.tsx` (behind Suspense, `requireOwner`, `notFound()` for a missing or ineligible video): header with title, creator, proposed stage and submission date; the existing player (`src/components/player/VideoPlayer.tsx`) with tokens from `signPlaybackTokens` for full-access videos, without hours counting; checklist and classification on the left, transcript on the right, as in the design. Mux ids never reach the client.

**Checkpoint**: US2 works alone; the decision bar is not there yet, so nothing can be approved.

---

## Phase 5: User Story 3 - Decide: approve, request changes or reject (Priority: P1)

**Goal**: Approve and publish, Request changes and Reject, atomic and role-checked; approval is visible to learners at once.

**Independent Test**: quickstart steps 6 and 8: approve a ready video and see it in the library at once; refuse approval with a missing piece; refuse changes and rejection without a note; only one of two simultaneous decisions wins.

### Tests for User Story 3

- [X] T029 [P] [US3] Create `tests/unit/review/decide.test.ts` against `tests/helpers/review-memory.ts`: approve refused for each of incomplete checklist, no segment, not ready (no playback id or duration), no stage, not In review (all leave the video unchanged and write no history); approve success sets final stage and access, status APPROVED and one history entry with the owner; changes and reject need a non-empty trimmed note (at most 2,000 characters); a second decision after the first is refused; two simultaneous decisions give exactly one winner (SC-010); every move out of REJECTED and out of APPROVED, to each other status, is refused for an owner and writes nothing (FR-017); a creator and a learner are refused for every decision (SC-009).
- [X] T030 [P] [US3] Create `tests/unit/review/approved-visible.test.ts` (pattern of `tests/unit/content-approved-only.test.ts` with `tests/helpers/content-db.ts`): a video approved by the service appears in `getVideos`, `getVideo`, search, host page and Up next at once with its transcript, asserted by reading straight after `decide` resolves, with a check that those reads complete in under 5 seconds (SC-004); a rejected or changes-requested video appears nowhere.
- [X] T031 [P] [US3] Create `tests/unit/review/DecisionBar.test.tsx`: Approve disabled with the reason line from the design until all items are ticked and a segment exists, note required messages for Reject and Request changes, buttons disabled while a decision is in flight (no double submit).

### Implementation for User Story 3

- [X] T032 [US3] Add `decide({ actor, videoId, decision, note })` to `src/lib/review/service.ts` and the store: one transaction; lock the video row; load status, checks, segment count, stage, access, title, topic, duration, playback id; for approve call `approveProblems` (T005); call `checkTransition({ from: "IN_REVIEW", to, by: "owner", note })` from `src/lib/content/status.ts`; update status with the conditional `where status = IN_REVIEW`; for approve write the final stage (the owner's, else the creator's proposal) and access; append the `VideoStatusEvent` (`actorId`, `actorLabel` = owner name or email, note) in the same transaction. Return a result with the event id for the email step. Do not change `status-service.ts`.
- [X] T033 [US3] Add the `decide` action to `src/lib/review/actions.ts` (zod: `decision` one of `approve`, `changes`, `reject`; `note` optional string at most 2,000 characters) and refusal copy to `messages.ts`; `revalidatePath` is not needed (learner reads are uncached).
- [X] T034 [P] [US3] Create `src/components/owner/DecisionBar.tsx` (client): note textarea with the design placeholder, Reject, Request changes and Approve and publish buttons, the `aria-describedby` reason line, confirmation of the outcome with a link back to the queue; wire it into `OwnerReviewScreen.tsx`. For a video in Changes requested show the status read-only instead of the bar.

**Checkpoint**: US1 to US3 give a complete review loop (without email).

---

## Phase 6: User Story 4 - Creators are told about every decision (Priority: P2)

**Goal**: one email per decision, failures recorded without undoing the decision, decisions visible in My videos.

**Independent Test**: decide one video of each kind; check one email each, the recorded outcome, and the creator's My videos and status page.

### Tests for User Story 4

- [X] T035 [P] [US4] Create `tests/unit/review/decision-email.test.ts`: subject and body for each outcome per contracts/decision-email.md, note included and HTML-escaped, title and name escaped, link targets, no Mux ids or other creators' data, plain text and HTML versions.
- [X] T036 [P] [US4] Create `tests/unit/review/decision-email-service.test.ts`: a decision sends exactly one email and records `SENT`; a mailer that throws records `FAILED` with a short reason, the decision stands and the result says `emailSent: false`; repeating a decision does not send a second email (`eventId` unique); a decision on a creator whose account has no email records a failure without throwing.
- [X] T037 [P] [US4] Create `tests/unit/review/creator-sees-decision.test.ts` using the existing creator reads: after each decision `listOwnVideos` and `listStatusHistory` show the new status and the note (shortened note in the list) for that creator only.

### Implementation for User Story 4

- [X] T038 [US4] First read `.env.example` and `src/lib/env.ts` and confirm the decision email needs no new setting (it reuses `AUTH_RESEND_KEY` and `EMAIL_FROM`). Then create `src/lib/review/email.ts`: `buildDecisionEmail({ outcome, title, creatorName, note, link })` returning subject, text and html (escape with the same helper style as `src/lib/invites/email.ts`), and `sendDecisionEmail` using Resend over `fetch` with `AUTH_RESEND_KEY` and `EMAIL_FROM`, the development log fallback as in `invites/email.ts`, and a short failure reason (no provider body).
- [X] T039 [US4] In `src/lib/review/service.ts` send the email after the `decide` transaction commits, then record a `DecisionEmail` row (`eventId`, `toEmail`, `outcome`, `failure` at most 200 characters); wire the mailer in `instance.ts`; return `emailSent` from `decide`.
- [X] T040 [US4] Show the email outcome to the owner: in `DecisionBar.tsx` the result line ("Salma has been told" or "We couldn't email Salma. Please tell them yourself."), and in the review screen's history list a "Email not sent" mark for a decision whose `DecisionEmail` is `FAILED` (read through `getReview`).
- [X] T041 [US4] Confirm the creator side needs no change: open `src/app/(creator)/creator/videos/page.tsx` and `[id]/page.tsx`; if a decision note does not show (latest note, history), fix it there and extend `tests/unit/creator/VideoTable.test.tsx`.

**Checkpoint**: decisions notify creators.

---

## Phase 7: User Story 5 - Invite and manage creators (Priority: P2)

**Goal**: the Creators page lists everyone with status and counts, resends invites, pauses and resumes creators, and shows per-creator stats.

**Independent Test**: quickstart steps 9 to 11: invite, resend (first link stops working), accept, pause (no upload or submit; live videos and host page stay), resume, stats.

### Tests for User Story 5

- [X] T042 [P] [US5] Create `tests/unit/creators/rules.test.ts`: status (Paused over Active, Invited only with no account, expired invitation shows Invited with an Expired mark), table rows merge creators and invitees, counts of live, in review and changes requested exclude soft-deleted videos.
- [X] T043 [P] [US5] Create `tests/unit/creators/service.test.ts` with an in-memory store: `pauseCreator` and `resumeCreator` set and clear `pausedAt` and append one `CreatorPauseEvent` each (idempotent calls append nothing), refused for non-creators and owners, refused for a creator calling them (SC-009); pausing changes no video status; a paused creator's videos still appear in the owner queue; `getCreatorStats` counts by status, approved this month, joined date, last upload date.
- [X] T044 [P] [US5] Extend `tests/unit/invites/` (find the existing service tests) with `resendInvite`: pending and expired are resendable, the earlier link stops working and expiry restarts at 7 days, used, revoked, owner or creator emails are refused, the hourly limit applies, a mailer failure leaves no pending invitation, a creator calling it is refused.
- [X] T045 [P] [US5] Create `tests/unit/creators/CreatorsTable.test.tsx`: Resend for Invited, Pause for Active, Resume for Paused, status badges from the design, no earnings or counted-views columns.

### Implementation for User Story 5

- [X] T046 [US5] Create `src/lib/creators/rules.ts` (pure, T042) and `src/lib/creators/store.ts` (Prisma; add to the dal-boundary allowed list): list creators with host name and grouped counts, invitations without accounts, set and clear `pausedAt` with the event row in one transaction, stats queries. The table covers the default language (Egyptian Arabic) only for now, as in the design: filter on `defaultLanguage.code` and leave a comment pointing at the future language filter.
- [X] T047 [US5] Create `src/lib/creators/service.ts` (`listCreators`, `getCreatorStats`, `pauseCreator`, `resumeCreator`; all owner-only), `instance.ts` and `actions.ts` (`"use server"`, `requireOwner`, zod ids) per contracts/routes-and-actions.md.
- [X] T048 [US5] Add `resendInvite({ actor, email })` to `src/lib/invites/service.ts` reusing the `createInvite` transaction and mailer, plus the `resendInvite` action in `src/lib/invites/actions.ts` and its copy in `src/lib/invites/messages.ts`.
- [X] T049 [P] [US5] Create `src/components/owner/CreatorsTable.tsx` and `PauseButton.tsx`, `ResendButton.tsx` (client, with confirmation text for pause: "They won't be able to upload or submit. Their live videos stay up.") from `docs/design/OwnerCreators.dc.html`; table columns Creator, Status, Videos live, In review, Changes requested, actions; no earnings and no counted-views columns.
- [X] T050 [US5] Update `src/components/screens/OwnerCreatorsScreen.tsx` to show the invite form, the new table and (below) the existing invitations list with Revoke; create `src/components/owner/CreatorStats.tsx`, `src/components/screens/OwnerCreatorScreen.tsx` and `src/app/(panel)/owner/creators/[id]/page.tsx` (behind Suspense, owner only, `notFound()` for an unknown or non-creator id).
- [X] T051 [US5] Tell a paused creator calmly: in the creator panel layout or Upload and My videos pages, when `actor.paused` show "Uploads are paused for now. Your videos are safe." and disable Upload, Save draft and Submit (the server already refuses); add a case to `tests/unit/creator/UploadForm.test.tsx` and `tests/unit/CreatorNav.test.tsx` as fits.

**Checkpoint**: all five stories work.

---

## Phase 8: Polish & Cross-Cutting

- [X] T052 [P] Create `tests/unit/owner-access.test.ts`: for every owner read and action (list them from `src/lib/review/*`, `src/lib/creators/*`, `resendInvite`) a creator, a learner and no actor are refused with no data returned (FR-028, FR-029, SC-009).
- [X] T053 [P] Brand and accessibility pass on the new screens: copy is short, warm and never shaming; no streaks, no infinite scroll, no tests; every control labelled, 44px targets, visible focus, 4.5:1 contrast; Arabic blocks carry `dir="rtl"` and `lang="arz"`; add a copy test in the style of `tests/unit/hours/brand-copy.test.ts` for the new messages.
- [X] T054 [P] Performance check: seed 500 segments in a test and assert saving one segment touches only that video's segments in one transaction and the editor renders without re-rendering unchanged rows (memoised rows); record the result in the commit message (SC-001, plan performance goals).
- [X] T055 Update `docs/build-specs.md` to mark spec 10 and update `README.md` if it lists owner pages; update the Mux webhook or invite docs only if their behaviour changed (it should not).
- [ ] T056 Run the whole walkthrough in `quickstart.md` against a development database (including the email log line and a real browser for the editor), timing two steps with a stopwatch and writing the times in the commit message: SC-001 (open a queued video whose transcript is already written, finish the review and approve: under 3 minutes) and SC-002 (import a 6-minute .vtt, fix it up and link at least 10 words to the glossary: under 15 minutes). Then `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; fix anything found.

---

## Dependencies & Execution Order

- Phase 1 (Setup) → Phase 2 (Foundational) → user stories → Phase 8 (Polish).
- **US1** needs only Foundational. **US2** needs Foundational and T014/T015 (the store and service shell from US1). **US3** needs US2 (the review screen to host the decision bar). **US4** needs US3 (`decide`). **US5** needs only Foundational (pause on the actor, schema) and can run in parallel with US1 to US4 by a second person.
- Within a story: tests first (they should fail), then pure rules, store, service, actions, components, screen.
- T007 must precede T008 and T051. T009 must precede US3 tests that cover resubmission. T032 precedes T039.

## Parallel Opportunities

- Foundational: T005/T006, T008, T010 and T011 touch different files and can run together after T003/T004.
- US1: T012, T013 and T016 in parallel.
- US2: T018 to T021 (tests) together; then T026 and T027 (components) together.
- US3: T029 to T031 together; T034 alongside T033.
- US4: T035 to T037 together.
- US5: T042 to T045 together; T049 alongside T047/T048.
- Whole stories: US5 in parallel with US1 to US4.

## Implementation Strategy

- **MVP**: Phases 1 to 5 (US1 to US3). That lets an owner see the queue, write a transcript and approve, request changes or reject. Creators would see the decisions in My videos, though without email.
- **Increment 2**: US4 (emails), then US5 (creator management). Pause is the one piece that touches the creator side, so US5 can ship first if a creator must be paused urgently.
- After each checkpoint run `npm test` and the matching quickstart steps before moving on.
