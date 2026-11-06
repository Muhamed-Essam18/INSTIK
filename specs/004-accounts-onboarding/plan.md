# Implementation Plan: Accounts and Onboarding

**Branch**: `004-accounts-onboarding` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-accounts-onboarding/spec.md`, plus the planning inputs: PostgreSQL with Prisma on a managed host (Neon), Auth.js with the Prisma adapter, the Google provider and email magic links through Resend, models User, Account, Session, VerificationToken, LearnerLanguage, Preference and ComprehensionAnswer, the watch route protected before it renders with a return URL, secrets in environment variables behind a typed check with `.env.example`, and tests for onboarding carry-over and the per-language profile rules.

## Summary

Add the first database and the first server-side identity to the app without making the public pages dynamic.

- **Identity**: Auth.js v5 with the Prisma adapter and database sessions. Google and a Resend email link are the only providers; there is no credentials provider, so passwords cannot exist.
- **Gate**: `src/proxy.ts` (this Next.js calls middleware "Proxy") does a cheap, optimistic check for a session cookie on the watch, roadmap, done and settings routes and redirects signed-out visitors to onboarding with a validated `returnTo`. It is not the security boundary. The real check is a small Data Access Layer (`requireLearner`) called by the protected pages and by every server action, which looks the session up in the database and verifies ownership.
- **Public pages stay static**: nothing outside the protected routes and the account button reads the session. The account button is its own server component behind `<Suspense>` with a same-size fallback.
- **Onboarding**: one client flow with four steps, whose choices live in a pure, tested "draft" kept in `localStorage` until an account exists. After Google or the email link the learner lands on `/onboarding/finish`, which turns the draft into a `LearnerLanguage` through a server action (never overwriting an existing profile).
- **Profiles**: one `LearnerLanguage` per user per language code, holding stage and minutes. The rules (one per language, available languages only, valid values, level-to-stage mapping, independence) are a pure module with tests.
- **Moving device choices**: for signed-in learners, transcript layers and فاهم؟ answers are read from the account on the server and written through server actions. On first sign-in on a device a one-time import copies the old device keys to the account and removes them.

See [research.md](research.md) for the decisions behind this.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` and `partialPrefetching` on), Node 24

**Primary Dependencies**: Existing: `zod`, Tailwind 4 tokens, `next/font`, Vitest. New runtime dependencies, each with a reason (constitution VII):
- Prisma pinned to the stable 7 line (`prisma@7` and `@prisma/client@7`, not the 8.0 release candidate)
- `next-auth@5.0.0-beta.32` (Auth.js v5; peers allow Next 16 and React 19; the stack names Auth.js; v5 is the App Router version and is only published under the `beta` tag)
- `@auth/prisma-adapter` (the requested adapter; stores users, accounts, sessions and tokens)
- `@prisma/client` and `@prisma/adapter-pg` plus `pg` (Prisma 7 talks to Postgres through a driver adapter; the pooled Neon connection)
- `server-only` (makes it a build error to import the database or env module into client code)
- Dev: `prisma` (CLI for schema, migrations and client generation, same major as the client)
- No `resend` SDK: Auth.js ships a Resend provider that calls Resend's HTTP API directly.

**Storage**: PostgreSQL (Neon) through Prisma for learner data. Files for content (unchanged). Browser `localStorage` only for the pre-account onboarding draft, and as the legacy source for the one-time import of transcript layers and answers.

**Testing**: Vitest + React Testing Library (jsdom). Pure modules carry the logic and are tested directly: onboarding draft, profile rules, `returnTo` sanitising, proxy path rules, device-preference merge, env parsing. Components (onboarding flow, account menu) are tested with stubbed server actions. Auth.js, Prisma and Resend are not exercised in unit tests; they are checked by build, type-check and the [quickstart](quickstart.md) against a Neon development branch.

**Target Platform**: Evergreen browsers 320px and up; Vercel with Neon Postgres

**Project Type**: Web application (single Next.js app, no separate backend)

**Performance Goals**: Public pages remain in the static shell. The session lookup happens once per request on protected pages (one indexed query), and the account button streams in without moving the layout. A sign-in email is requested and acknowledged on the page in under 2 seconds on a normal connection.

**Constraints**: `next build` and the tests must pass with no `.env.local` (the Prisma client and the Auth.js config are created lazily on first request); No passwords anywhere; no secrets reach the browser (only the existing public variables); every mutation validated with zod and checked for ownership; 44px targets; contrast at least 4.5:1; no horizontal scroll from 320px; no hydration mismatches (nothing reads browser storage during render); brand voice on every message.

**Scale/Scope**: 7 screens or states (onboarding, finish, sign in, check email, sign-in error, settings, add language), about 14 components, 7 pure modules, 7 database models, 6 server actions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | MVP screen 2 (onboarding) plus the account behaviours in `docs/product.md` ("Learner data ... lives in the database"). `docs/product.md` now records the design decision that the utility screens (sign-in, check email, sign-in error, settings with add language, account menu) are part of the MVP. No hours, payments or level test |
| II. Brand behaviours | Pass | Listening check optional, no score, never blocks; "no streaks, nothing to lose" copy; no reminders switched on; learner stage names only; messages short, warm, never shaming; sign-in errors never reveal whether an address has an account |
| III. Honest hours | Pass (n/a) | No hours are counted. `LearnerLanguage` is the per-language record later specs attach hours to |
| IV. Multi-language by design | Pass | Records keyed by language **code** from `content/languages.json`; the language list in onboarding and "Add a language" comes from that data and its `status`; nothing Arabic-specific in schema or code. Preference layers are stored as validated JSON so languages with different layer sets work |
| V. Arabic first-class | Pass | The ask at the layer level is unchanged: stored text is untouched. The فاهم؟ word still comes from language data |
| VI. Design fidelity | Pass with one note | Onboarding is built from `Onboarding.dc.html` with tokens. Note: the design's last button is a link to the Library; the plan shows "Start watching" only when signed in, as the spec requires, and shows nothing but the sign-in options before that. Sign-in, check-email, error, settings, add-language and the account menu have no separate design; per the decision recorded in `docs/product.md` they are built from the design system and the patterns of the approved screens, and tasks check that the note exists before they are built |
| VII. Stack discipline | Pass | Auth.js, Prisma, Postgres, Resend are the named stack. Server Components by default; client components only for the onboarding flow, forms with pending state and the account menu. Next docs read: proxy, authentication, authentication with Cache Components, environment variables, server actions. The Next.js "middleware" is `proxy.ts` here |
| VIII. Content as files | Pass | Languages and videos stay files. Only learner data goes in the database, never in `content/` |
| IX. Quality | Pass | Tests for draft carry-over, profile rules, `returnTo`, proxy rules, preference merge, env check, onboarding flow and account menu; lint, type-check and build gates |
| X. Privacy and security | Pass | Email, optional name and image, profiles, layers and answers only. Secrets only in server env behind `server-only` and a typed check. All inputs parsed with zod; every action calls `requireLearner` and filters by the session's user id; `returnTo` accepts only same-site paths; sign-in links are single-use and expire in 60 minutes; sends are rate limited |

No violations. Re-check after design: still passes (see [data-model.md](data-model.md) and [contracts/](contracts/)).

## Project Structure

### Documentation (this feature)

```text
specs/004-accounts-onboarding/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes-and-gate.md
│   ├── server-actions.md
│   └── environment.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
.env.example                         # every variable, no values; committed (.gitignore already ignores .env*)
prisma/
├── schema.prisma                    # models in data-model.md
└── migrations/                      # created by `prisma migrate`
prisma.config.ts                     # schema path and the direct (non-pooled) URL for migrations

src/
├── proxy.ts                         # optimistic gate: cookie present? else redirect with returnTo
├── instrumentation.ts               # validates env once when the server starts
├── auth.ts                          # Auth.js config: adapter, providers, database sessions, pages, 60-minute links
├── app/
│   ├── api/auth/[...nextauth]/route.ts      # Auth.js handlers (GET, POST)
│   └── (shell)/
│       ├── onboarding/
│       │   ├── page.tsx                      # steps 1-4 (client flow inside Suspense), redirects signed-in learners
│       │   └── finish/page.tsx               # turns the draft into a profile, then goes to returnTo or the Library
│       ├── sign-in/
│       │   ├── page.tsx                      # Google + email form for returning learners
│       │   ├── check-email/page.tsx          # "Check your inbox" (same text whether or not the address exists)
│       │   └── error/page.tsx                # kind message + ask for a new link
│       └── settings/
│           ├── page.tsx                      # email, profiles, change stage and minutes
│           └── add-language/page.tsx         # language list, then stage and minutes steps
├── lib/
│   ├── env.ts                       # server-only zod env: parse once, throw a readable list of problems
│   ├── db.ts                        # server-only Prisma client (pg adapter), one instance in dev
│   ├── session.ts                   # server-only DAL: getLearner(), requireLearner(returnTo)
│   ├── routes.ts                    # + signInPath, onboardingFinishPath, settingsPath, addLanguagePath
│   ├── learner/
│   │   ├── profile-rules.ts         # pure: levels -> stage, minutes, canAddProfile, watchAccess (tested)
│   │   ├── profiles.ts              # server-only: create/update/list LearnerLanguage using the rules
│   │   ├── actions.ts               # server actions: completeOnboarding, addLanguage, updateProfile
│   │   ├── preferences.ts           # server-only: get/save layers and answers; apply device import
│   │   └── preference-actions.ts    # server actions: saveLayers, saveAnswer, importDevicePreferences
│   ├── onboarding/
│   │   ├── draft.ts                 # pure: schema, step guard, reduce, toProfileInput (tested)
│   │   ├── draft-storage.ts        # client: read/write/clear the draft in localStorage, memory fallback
│   │   └── copy.ts                  # step copy and level options (single place for the design's text)
│   ├── auth/
│   │   ├── return-to.ts             # pure: sanitiseReturnTo (same-site paths only) (tested)
│   │   ├── gate.ts                  # pure: isProtectedPath, hasSessionCookie, buildGateRedirect (tested)
│   │   ├── throttle.ts              # server-only: per-address and per-visitor send limits
│   │   └── actions.ts               # server actions: requestEmailLink, signInWithGoogle, signOutAction
│   └── player/
│       ├── preferences.ts           # unchanged: keys and schemas still used for the one-time import
│       └── device-import.ts         # pure: merge rules for layers and answers (tested)
├── hooks/
│   ├── useAccountLayers.ts          # layers from the account, optimistic, quiet failure note
│   └── useAccountAnswer.ts          # answer from the account, optimistic, quiet failure note
└── components/
    ├── onboarding/
    │   ├── OnboardingFlow.tsx       # client: draft state, steps, back/continue, restores after reload
    │   ├── StepProgress.tsx         # "Step N of 4" and the four-part bar
    │   ├── LanguageStep.tsx  LevelStep.tsx  TimeStep.tsx  AccountStep.tsx
    │   ├── ChoiceCard.tsx           # radio-style option shared by the steps
    │   └── SignInForm.tsx           # Google button + email field, used by step 4 and /sign-in
    ├── shell/
    │   ├── AccountButton.tsx        # client menu: Settings, Sign out
    │   ├── UserSlot.tsx             # server: reads the session behind Suspense, renders button or "Sign in"
    │   └── Header.tsx               # uses UserSlot instead of the placeholder button
    ├── settings/
    │   ├── ProfileList.tsx  ProfileForm.tsx  AddLanguageList.tsx
    └── watch/
        └── SignInPrompt.tsx         # shown on onboarding when returnTo is a video (title, host)

tests/unit/
├── onboarding-draft.test.ts   profile-rules.test.ts   return-to.test.ts   gate.test.ts
├── device-import.test.ts      env.test.ts             draft-storage.test.ts   throttle-rules.test.ts
├── access-rules.test.ts       public-pages-static.test.ts   no-passwords.test.ts
├── OnboardingFlow.test.tsx    FinishOnboarding.test.tsx     DeviceImport.test.tsx
├── AccountButton.test.tsx     UserSlot.test.tsx             SignInForm.test.tsx   CheckEmail.test.tsx
└── route-links.test.tsx (updated for the new routes)
```

**Structure Decision**: Single Next.js app, as before. Pure rules (`profile-rules`, `draft`, `return-to`, `gate`, `device-import`) sit apart from anything that touches Prisma or Auth.js, so the logic the spec cares about is tested without a database. Files that import the database or env start with `import "server-only"`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | n/a | n/a |

Two additions beyond the requested model list are noted for review: a small `SignInAttempt` table for the rate limit the spec requires (FR-008), and the Prisma `pg` driver packages Prisma 7 needs. Both are in [research.md](research.md).
