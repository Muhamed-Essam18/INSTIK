# Implementation Plan: Roles, Creator Invites and Content in the Database

**Branch**: `008-roles-invites-content-db` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-roles-invites-content-db/spec.md`

## Summary

Move videos, hosts, transcripts and the glossary from `content/` files into PostgreSQL, add a status machine with an
append-only history, and add roles (learner, creator, owner) with an invitation flow. The learner site is rewired from
synchronous file reads to asynchronous, Approved-only database reads with the same screens. A repeatable import script
loads the existing sample content. Creator and owner areas ship as empty pages guarded in the Data Access Layer
(`src/lib/session.ts`); the owner area also holds the minimal invite form needed to create creators.

Findings that shaped the plan:

- Only 2 of the 8 sample videos have a transcript file. A missing transcript is normal (as today); only a transcript
  that is present but invalid makes a video a Draft. The spec edge case was corrected to say so.
- Learner records (`VideoProgress`, `WatchSession`, `ComprehensionAnswer`) refer to videos by `languageCode` + `videoSlug`
  text, not by a foreign key. Imported videos keep their slugs, so nothing learner-side migrates (FR-025).
- Pages currently call `generateStaticParams` from the files. With the database this would need a database at build time,
  which the project avoids; those functions are removed and the pages render per request (they are already dynamic behind
  the session).

## Technical Context

**Language/Version**: TypeScript (strict), Node 24, Next.js 16.4.5 App Router with `cacheComponents`, React 19.3

**Primary Dependencies**: Prisma 7 with `@prisma/adapter-pg`, Auth.js v5 beta (database sessions), zod 4; no new runtime
dependencies (invite tokens use `node:crypto`; email uses the existing Resend call). One new **devDependency**, `tsx`,
to run `scripts/import-content.ts`: Node's built-in TypeScript stripping cannot resolve our extensionless relative imports
(for example `./schema` in `src/lib/content/validate.ts`, or `./enums` in the generated Prisma client), and `tsx` runs the
project's TypeScript as it is written without touching those imports. It is not shipped with the app.

**Storage**: PostgreSQL (Neon). New tables for hosts, videos, transcript segments, glossary entries, status events and
creator invitations; two new columns on `User`. Languages stay in `content/languages.json`.

**Testing**: Vitest (jsdom). Pure modules (status machine, invite rules, import planner, role resolution) and the learner
mapping are unit-tested; data access is tested through the same injected-store pattern as billing (`SyncStore`), with an
in-memory fake. A live-database check is in [quickstart.md](quickstart.md).

**Target Platform**: Vercel (Node runtime) with managed Postgres

**Project Type**: Single Next.js web application

**Performance Goals**: Library and watch pages render as fast as today on the sample set (SC-009); a language's library
is one query for videos plus one for hosts; the transcript is one ordered query.

**Constraints**: Build and tests must not need a database or secrets (`db()` stays lazy); every permission check is in the
Data Access Layer; learner-facing reads accept no status argument and always filter to Approved; invite tokens are never
stored in plain text.

**Scale/Scope**: Tens of videos per language now, hundreds soon; a handful of creators and owners; 8 sample videos,
2 hosts, ~40 glossary entries to import.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
|---|---|---|
| I Source of truth | Pass | Implements the Content model and Roles sections of `docs/product.md`; screens 9–16 appear only as empty, guarded pages plus the minimal invite form (needed for screen 15's invite action). |
| II Brand behaviours | Pass | No learner-facing change; lists still end, Hosts and Up next unchanged; no internal levels in copy. |
| III Honest hours | Pass | Counting code untouched; progress tables keep their keys. |
| IV Multi-language | Pass | Languages stay in `content/languages.json`; every new content table carries `languageCode`. |
| V Arabic first-class | Pass | Script stored with tashkeel as imported; search normalisation unchanged. |
| VI Design fidelity | Pass | Empty pages reuse the existing placeholder component and tokens. |
| VII Stack | Pass | Same stack; no new runtime dependency; Next.js docs read for caching and proxy (see research). |
| VIII Content in database | Pass | Status path enforced by a pure state machine; learner reads are Approved-only on every path; history append-only (database trigger plus no update/delete code path); languages remain data. |
| IX Quality | Pass | Tests for status machine, invites, import, role/ownership scoping, Approved-only filter. |
| X Privacy and security | Pass | Invite tokens stored hashed; owner emails come from the environment; non-owners get a not-found, not a forbidden page. |
| XI Roles and permissions | Pass | `requireRole`, `requireOwner`, `requireCreator` live in the Data Access Layer; creator reads take the acting creator and scope by it. See "Data Access Layer" below for what counts as the layer. |
| XII Money | N/A | No money in this spec. |
| XIII Direct upload | N/A | No uploading in this spec. |

Result: no violations; Complexity Tracking is empty. Re-check after design: unchanged, all Pass.

## Data Access Layer

Constitution XI says every permission is checked in the Data Access Layer and code outside it must not query the
database directly. For this project the layer is exactly:

1. `src/lib/session.ts`: the session and role gates (`getActor`, `requireRole`, `requireOwner`, `requireCreator`,
   `requireLearner`, `requireProfile`).
2. The **stores** (the only modules that call `db()` for their tables): `src/lib/invites/store.ts`,
   `src/lib/content/import/store.ts`, the status writes inside `src/lib/content/status-service.ts`, and the existing
   billing and learner stores.
3. The **read modules that take an `Actor`**: `src/lib/content/creator-reads.ts` and the invite listing in
   `src/lib/invites/service.ts`.
4. The **learner content reads** in `src/lib/content/index.ts` and `library.ts`, which take no actor and are Approved-only
   by construction (one shared `approvedOnly` filter, no status argument).

The existing modules that already queried the database before this spec (each scoped by the signed-in user) belong to the
layer too: `src/auth.ts` (the Auth.js adapter), `src/lib/auth/throttle.ts`, `src/lib/billing/*` (checkout, store,
subscription), `src/lib/hours/*` (queries, service), `src/lib/learner/*` (preferences, profiles) and `src/lib/waitlist/*`.

Anything else (pages, components, server actions, other `src/lib` modules) MUST go through these and MUST NOT import
`db()`. `tests/unit/dal-boundary.test.ts` holds the exact list and fails on any other file that imports the database
client (task T049). One page did so before this spec (`settings/page.tsx` read the time zone); that query moved into
`src/lib/learner/profiles.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/008-roles-invites-content-db/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes-and-actions.md
│   └── import-report.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                         # + Role, VideoStatus, Host, Video, TranscriptSegment, GlossaryEntry,
│                                         #   VideoStatusEvent, CreatorInvite; User.role
└── migrations/<ts>_creator_content/      # tables, constraints, append-only trigger on VideoStatusEvent

scripts/
└── import-content.ts                     # one-time, repeatable import; prints the report (tsx scripts/import-content.ts)

src/lib/
├── env.ts                                # + OWNER_EMAILS (optional, comma-separated)
├── session.ts                            # DAL: + getActor, requireRole, requireOwner, requireCreator
├── roles/
│   ├── rules.ts                          # pure: parseOwnerEmails, resolveRole, canView
│   └── actor.ts                          # Actor type
├── invites/
│   ├── rules.ts                          # pure: token hash, expiry, state, accept checks
│   ├── store.ts                          # Prisma side (transactional accept)
│   ├── service.ts                        # create / revoke / accept / list, with injected store and mailer
│   ├── email.ts                          # invitation email (plain text + html)
│   └── actions.ts                        # server actions for the owner form and the accept page
├── content/
│   ├── status.ts                         # pure: statuses, allowed transitions, note rules
│   ├── status-service.ts                 # changeStatus (writes event + status atomically)
│   ├── index.ts                          # rewritten: async, Approved-only learner reads
│   ├── creator-reads.ts                  # creator/owner scoped reads (take Actor)
│   ├── import/
│   │   ├── plan.ts                       # pure: raw files + existing rows -> actions + report
│   │   ├── run.ts                        # applies a plan through a store; idempotent
│   │   └── store.ts                      # Prisma side
│   └── (existing validate.ts, vtt.ts, transcript.ts, schema.ts reused by the importer)
src/app/
├── (shell)/learn/...                     # pages await content reads; generateStaticParams removed
├── (panel)/layout.tsx                    # quiet panel shell
├── (panel)/creator/page.tsx              # empty creator home
├── (panel)/owner/page.tsx                # empty owner home
├── (panel)/owner/creators/page.tsx       # invite form + invitation list (minimal)
└── invite/[token]/page.tsx               # accept page
src/proxy.ts                              # + optimistic cookie check for /creator, /owner

tests/unit/                               # roles-rules, invites-rules, invites-service, status-machine,
                                          # import-plan, import-run, content-approved-only, creator-scope
```

**Structure Decision**: Keep the single Next.js app and extend the existing layering: pure rules modules, an injected
store for Prisma, and the Data Access Layer in `src/lib/session.ts`. The learner-facing content API keeps its function
names (`getVideos`, `getVideo`, `getHost`, …) but becomes async and Approved-only, so each caller changes by adding
`await` rather than being redesigned.

## Complexity Tracking

No constitution violations to justify.
