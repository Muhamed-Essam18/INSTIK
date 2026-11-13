# Implementation Plan: Owner Panel: Review, Transcripts and Creators

**Branch**: `010-owner-panel-review` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-owner-panel-review/spec.md`

## Summary

Turn the owner area from spec 8 into the owner panel: a Review queue, a Review screen with the player, checklist, stage and
access, an autosaving transcript editor (with .vtt import and glossary entries) and the three decisions, a decision email to the
creator, and a Creators page with invite, resend, pause, resume and per-creator stats.

Findings that shaped the plan (all checked in the code):

- **The pieces exist.** `src/lib/content/status.ts` already allows exactly the owner moves IN_REVIEW → APPROVED / CHANGES_REQUESTED /
  REJECTED and requires notes; `vtt.ts` parses WebVTT; `glossary-link.ts` links words by matching; `creator-reads.ts` already
  has owner-aware reads; `invites/` already creates, revokes and lists invitations; `billing/playback.ts` signs playback.
  This spec adds an owner review service, an editor, a pause flag and a mailer, and reuses the rest.
- **Decisions get their own transaction.** `status-service.changeStatus` cannot check "checklist complete and transcript exists" in
  the same transaction as the status write. The review service uses its own transaction, calls the same pure `checkTransition`
  for the path and note rules, and writes the same `VideoStatusEvent` row, so the rules stay in one place and the approval
  guard cannot be raced (FR-013, FR-016).
- **Word links are derived, not stored.** The learner site links words by matching the glossary at render time, so there is no
  per-segment link to store. "Link words to the glossary" becomes: show which words match, add glossary entries, correct entries.
  Spec FR-010 was updated to say so.
- **Visible immediately costs nothing.** The learner site reads the database on every request (no `use cache`, no
  `revalidate*` anywhere in `src`), so setting the status to Approved is enough. A test proves a just-approved video appears in the
  library, search, host page and Up next.
- **Pause is a flag on the account**, read fresh with the role on every request like the role is today, and enforced in the one
  `canUpload` check that spec 9 already routes every creator write through (its comment says spec 10 extends it).
- **Submission date** is the newest IN_REVIEW history entry; `Video.submittedAt` is cleared when a submission completes, so it
  cannot be used. "Approved this month" counts APPROVED history entries.
- **"This month" is Europe/Warsaw time.** Approved-this-month and creator stats use that zone; spec 11 earnings months will use the same one.
- **Creator stats are content counts only.** Counted views and earnings do not exist yet and are out of scope.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 types, React 19.3, Next.js 16.4.5 (App Router, `cacheComponents: true`)

**Primary Dependencies**: existing only: Prisma 7 with `@prisma/adapter-pg`, zod 4, `@mux/mux-player-react` (via the existing
`VideoPlayer`), Resend over `fetch` (as in `invites/email.ts`). No new runtime dependency.

**Storage**: PostgreSQL via Prisma. One migration: pause fields and `CreatorPauseEvent`, review checklist on `Video`, `revision` on
`TranscriptSegment`, `DecisionEmail`.

**Testing**: Vitest (unit, jsdom for components) with the existing in-memory store pattern (`createXService({ store, ... })`); role
tests with a creator attempting every owner action.

**Target Platform**: Vercel, desktop-first web.

**Project Type**: Single Next.js web application (no separate backend).

**Performance Goals**: queue and counts load in one round trip each; autosave of a segment completes in under 1 second typical;
a 500-segment transcript stays responsive (per-segment writes, no whole-transcript rewrite).

**Constraints**: every owner read and write checked on the server in the data access layer (XI); notes required for changes and
reject; approve guard inside the decision transaction; decision emails never undo a decision; copy follows the brand voice.

**Scale/Scope**: tens of creators, hundreds of videos, transcripts up to a few hundred segments; three screens plus one stats view.

## Constitution Check

*GATE: passes before research; re-checked after design.*

| Principle | Status |
|-----------|--------|
| I. Source of truth | Pass. Screens 13-15 in `docs/product.md`; earnings (16) stays out. |
| II. Brand behaviours | Pass. Lists end (the queue and creators table are finite, no infinite scroll); emails are decision-only, kind, rare; no streaks or tests added. |
| III. Honest hours | Not touched. |
| IV. Multi-language | Pass. Stage, glossary and segments belong to the video's language; Arabic blocks carry `dir="rtl"` and `lang="arz"` from language data; the Creators page filters on the default language for now. |
| V. Arabic first-class | Pass. Tashkeel stored as typed; matching reuses `stripTashkeel`/`linkWords`; Naskh font at the design size. |
| VI. Design fidelity | Pass. Built from `OwnerReviewQueue`, `OwnerReview` and `OwnerCreators` with tokens; 44px targets, labelled controls, visible focus. The designs' side navigation is new for the panel and is built from the same tokens (see research). |
| VII. Stack discipline | Pass. One app, Server Components by default, client components only for the editor, checklist and actions; Next docs read before code. |
| VIII. Review-gated publishing | Pass. Only Approved is learner-visible; final stage, access and transcript set only by owners; note rules enforced on the server. |
| IX. Quality | Pass. Pure modules (checklist rules, segment validation, vtt-to-segments, decision guard, queue badges) with tests. |
| X. Privacy/security | Pass. Zod on every action input; no secrets to the client; Mux ids stay server-side; emails carry no more than needed. |
| XI. Roles | Pass. Owner-only reads and writes inside the DAL; pause enforced server-side on every creator write; tests include a creator trying each owner action. |
| XII. Money | Not touched. |
| XIII. Direct upload | Pass. Pause blocks creating upload links; files still never touch our server. |

Re-check after design: still passes; no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/010-owner-panel-review/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes-and-actions.md
│   └── decision-email.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # pause, checklist, segment revision, DecisionEmail
└── migrations/<ts>_owner_review/migration.sql

src/lib/review/                         # new: owner review domain
├── rules.ts                            # pure: checklist items, approve guard, queue badge, days waiting
├── segments.ts                         # pure: segment validation, ordering, overlaps, vtt cues -> segments
├── service.ts                          # createReviewService({ store, mailer, ... }): queue, open, save, decide
├── store.ts                            # Prisma store (the only place the review tables are queried)
├── glossary.ts                         # pure + store calls: which words match, add/correct entries
├── email.ts                            # decision email builder and Resend sender
├── messages.ts                         # kind copy for refusals
├── instance.ts                         # wiring (per call, nothing read at import time)
└── actions.ts                          # "use server" actions, each re-checks the owner role
src/lib/creators/                       # new: owner's creator management
├── rules.ts                            # pure: creator state (Active/Invited/Paused), table rows
├── service.ts                          # list, pause, resume, stats
├── store.ts
├── instance.ts
└── actions.ts
src/lib/invites/service.ts              # extended: resendInvite
src/lib/creator/can-upload.ts           # extended: paused creators refused
src/lib/roles/actor.ts, src/lib/session.ts   # Actor.paused read fresh per request
src/lib/creator/upload-service.ts, store.ts  # resubmission clears the review checklist
src/lib/routes.ts                       # ownerReviewPath, ownerReviewVideoPath, ownerCreatorPath

src/app/(panel)/owner/
├── layout.tsx                          # owner side navigation (Review queue, Creators)
├── page.tsx                            # becomes the Review queue
├── waiting/page.tsx                    # Changes requested list (read-only entries)
├── review/[id]/page.tsx                # review screen
└── creators/page.tsx, creators/[id]/page.tsx

src/components/owner/                   # QueueTable, ReviewChecklist, FinalClassification, TranscriptEditor,
                                        # SegmentRow, VttImport, WordPanel, DecisionBar, CreatorsTable, CreatorStats
src/components/screens/                 # OwnerQueueScreen, OwnerReviewScreen, OwnerCreatorsScreen (extended), OwnerCreatorScreen

tests/unit/review/, tests/unit/creators/    # rules, segments, service, email, access, components
tests/helpers/review-memory.ts              # in-memory review store
```

**Structure Decision**: Keep the repo's pattern: pure rules, a service with injected store and mailer, a Prisma store, a per-call
instance file, thin server actions and screens. The review and creator-management domains each get their own folder so nothing
about owners leaks into `lib/creator` (which stays the creator's own side).

## Complexity Tracking

No constitution violations. Two deliberate choices worth noting:

| Choice | Why | Simpler alternative rejected |
|--------|-----|------------------------------|
| Decision service has its own transaction instead of extending `changeStatus` | The approve guard must read checklist and segments in the same transaction as the status write | A callback hook in `changeStatus` would give a shared service knowledge of review tables |
| Per-segment revision for concurrent edits | The spec forbids silently overwriting another owner's work | A whole-transcript version would make every keystroke save conflict with unrelated segments |
