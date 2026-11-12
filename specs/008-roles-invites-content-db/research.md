# Research: Roles, Creator Invites and Content in the Database

No `NEEDS CLARIFICATION` items remained after `/speckit-clarify`. These are the design decisions and why.

## 1. Where the role lives

- **Decision**: A `role` column on `User` (`LEARNER` default, `CREATOR`), plus an owner check computed from the
  `OWNER_EMAILS` environment variable on every request. Owner is never stored.
- **Rationale**: FR-002 says the list is the only way to be an owner and that removing an email withdraws access at the
  next check; storing it would need syncing. Creator is a real state change made by accepting an invite, so it is stored.
- **Order of precedence**: owner (by list) > creator > learner. A creator whose email is later added to the list acts as
  owner; the stored `CREATOR` value is kept.
- **Alternatives**: stored owner flag (drifts from the list); a separate roles table (more than three fixed roles need).

## 2. Invite tokens

- **Decision**: 32 random bytes (`node:crypto`), base64url in the link; only the SHA-256 hash is stored. State is
  derived: pending (not used, not revoked, not expired), used, revoked, expired. Re-inviting an email revokes earlier
  pending invites for it in the same transaction.
- **Acceptance**: one transaction. A conditional update (`usedAt IS NULL AND revokedAt IS NULL AND expiresAt > now`)
  claims the invite; if zero rows change the accept fails. Then the user's role is set and the profile created. A failure
  anywhere rolls everything back (FR-008) and two simultaneous accepts cannot both win.
- **Email match**: the signed-in account's email (lower-cased) must equal the invited email. This is the simple reading of
  "turns the account into a creator" and stops a forwarded link from granting the role to someone else.
- **Alternatives**: store raw tokens (a database leak would grant creator access); Auth.js `VerificationToken` (shaped for
  sign-in, no name, no state, 1 hour default).

## 3. Invitation email

- **Decision**: Reuse the Resend `fetch` pattern already used for sign-in (`src/auth.ts`). Factor a tiny shared
  `sendEmail` helper only if it avoids copying the request; otherwise a sibling function in `src/lib/invites/email.ts`.
  The mailer is injected into the service so tests need no network.
- **Content**: invited name, Instik team name, the link, and when it expires. Nothing else (FR-007).

## 4. Database shape for content

- **Decision**: Relational tables (see [data-model.md](data-model.md)). One `Host` table serves both the sample hosts and
  creator profiles: `Host.userId` is set (unique) for a creator, null for imported hosts. This keeps "a creator's profile
  is their public host page" a single code path for host pages.
- **Learner tables are untouched**: they keep `languageCode` + `videoSlug`. A video's identity for learners is
  `(languageCode, slug)`, unique in `Video`. No foreign key is added, so removing or re-slugging a video never cascades
  into learner data, and imported videos need no learner migration.
- **Stage and topic**: stored as the existing slugs (`hear-it`, `food`, …) via a text column validated against
  `taxonomy.ts` at write time, not new enums, so adding a topic stays a code change in one place. Stage reuses the slug
  form the content files and URLs already use.
- **Transcript**: one row per segment, ordered by `position`, with `start`/`end` as seconds (`Float`), script, and nullable
  transliteration and English. Word links are not stored: they are computed from the glossary at read time exactly as
  today (`linkWords`), so a glossary fix improves every transcript.
- **Glossary**: one row per entry per language with the existing entry `id` kept as `entryKey`, unique per language.

## 5. Append-only status history

- **Decision**: `VideoStatusEvent` rows are only inserted. A database trigger in the migration raises on `UPDATE` and
  `DELETE`, so the rule holds even for code outside the app. The status change service writes the new `Video.status` and
  the event in one transaction, after the pure state machine approves the move.
- **Allowed moves** (FR-019): Draft → Uploading → Processing → In review; Processing → Draft (failed processing, automatic note);
  In review → Approved | Changes requested | Rejected; Changes requested → Uploading | In review. Rejected and Approved are
  terminal in this spec.
- **Who may make each move** (FR-030): `checkTransition` takes the kind of actor. `system` (the video host's webhook, in a
  later spec): Uploading → Processing, Processing → In review (ready), Processing → Draft (failed; the service records the automatic note "The upload didn't work. Please try again.").
  `creator` (own videos only): Draft → Uploading, Changes requested → Uploading, Changes requested → In review. `owner`:
  In review → Approved | Changes requested | Rejected. Saving a draft changes no status. Any other pairing is refused.
- **The import is the one exception and bypasses the status service entirely** (FR-019): it uses its own store to create a
  video directly as Approved (an initial event with no previous status) and to move an import-made incomplete Draft to
  Approved. It never calls `changeStatus`, so the status rules stay strict for everyone else.
- **Notes**: required, non-blank, for Rejected and Changes requested; optional otherwise; capped at 2,000 characters.
- **Actor**: `actorId` (nullable user id) plus `actorLabel` text (for example `import` or the person's name at the time)
  so history stays readable if the account is later deleted; the foreign key uses `SetNull`.

## 6. Approved-only, everywhere

- **Decision**: The learner content module exposes no way to ask for another status. Every query it makes has
  `status: APPROVED` in one shared `where` helper (`approvedOnly`). Creator and owner reads live in a different module
  (`creator-reads.ts`) that requires an `Actor`. A test walks every exported learner read with a non-Approved fixture.
- **Hidden state**: a non-Approved video returns `undefined`/not-found, never "exists but unavailable" (FR-024).
- **Up next, library, search, host pages, pick-up-where-you-left-off, progress**: all go through the same reads; progress
  rows for a video that is not Approved are simply not joined to anything visible.

## 7. Async content API, caching and build time

- **Decision**: `src/lib/content/index.ts` keeps its function names but returns promises. Callers (about 15 files) add
  `await`. The module-level `loadAllContent()` call is removed.
- **Caching**: Next.js 16 with `cacheComponents` is enabled. Learner pages already read the session, so they render per
  request inside Suspense; the database reads stay uncached at first. Adding `use cache` with a `content` tag later is a
  contained change; skipped now so a status change can never serve a stale Approved list. (Guide read:
  `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.)
- **Build**: `generateStaticParams` for watch and host pages is removed because it would need the database at build.
  `generateMetadata` reads the title through the same Approved-only read.
- **Alternatives**: keep static generation by querying at build (breaks "build needs no secrets"); a cached snapshot of
  content (second source of truth).

## 8. Import design

- **Decision**: `scripts/import-content.ts`, run with `tsx` (a devDependency). Node's own TypeScript stripping works for
  `scripts/stripe-setup.ts` only because `plans.ts` has no relative imports; the validators the importer must reuse
  (`validate.ts`, `glossary-link.ts`) and the generated Prisma client use extensionless relative imports that Node cannot
  resolve. `tsx` loads them unchanged, so there is no rewrite of existing modules and no second copy of the validation.
  It reads `content/` with the existing loaders and validators, builds a pure plan against what is already in the database,
  then applies it. The importer's modules must not import `server-only`, `db()` or `env()`.
- **Alternatives**: add `.ts` extensions to many existing modules (large, noisy change); bundle with esbuild first (extra
  build step); an owner-only import route (needs a deployed app to seed data).
- **Idempotence**: identity is `(languageCode, slug)` for videos and hosts and `(languageCode, entryKey)` for glossary.
  Existing rows are never updated ("nothing already imported is changed"). A second run reports everything as already
  present.
- **Completion of drafts**: a video that the import itself left as an incomplete Draft (its first event has actor `import`
  and a note starting `Import incomplete:`) is completed on a later run once its source is valid: transcript added,
  status moved to Approved with an event.
- **Incomplete means**: the video itself is valid but its transcript file exists and is unreadable, empty or invalid. A
  video with no transcript file is complete (six of the eight sample videos). A video that fails its own schema, names an
  unknown host or has a duplicate slug cannot be saved meaningfully and is reported as failed, not drafted.
- **Hosts and glossary** that fail are reported as failed; videos depending on a missing host fail with that reason.
- **Report**: counts and per-item reasons, printed as text and also as JSON with `--json`; exit code 1 if anything failed
  or is incomplete, 0 otherwise. See [contracts/import-report.md](contracts/import-report.md).
- **Atomicity**: each video (row, segments, event) is written in one transaction so a failure never leaves a video
  without its history.

## 9. Protected areas and "turned away"

- **Decision**: Route group `(panel)` with `/creator` and `/owner`. `requireCreator(returnTo)` and
  `requireOwner(returnTo)` in `src/lib/session.ts`: no session redirects to sign-in with `returnTo`; wrong role calls
  `notFound()`, so a learner cannot tell that the page exists. The proxy gets an optimistic cookie check for these paths
  like the learner paths (Next.js 16 docs: proxy is a cheap first gate only; the DAL decides).
- **Owner may open the creator area?** No: the creator area is for creators (spec FR-026). Owners reach their own area.
- **Alternatives**: a 403 page (reveals the area); role in the session cookie (stale after list or role change).

## 10. Creator-scoped data access

- **Decision**: Every creator-side read is a function that takes `Actor` and builds its `where` from it:
  `where: { host: { userId: actor.id } }` for creators, no extra filter for owners. There is no exported function that
  takes a bare creator id. A unit test with two creators asserts neither can read the other's videos, history or profile
  edit target. (Tests use the in-memory store fake; the same scoping function builds the Prisma filter.)

## 11. Owner configuration

- **Decision**: `OWNER_EMAILS` optional environment variable, comma separated, trimmed and lower-cased, invalid entries
  ignored with a startup-time zod check (same style as `env.ts`). Added to `.env.example`. An empty list means no owners.
- **Why optional**: build and tests need no secrets.
