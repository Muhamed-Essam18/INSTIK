# Implementation Plan: Creator Statistics and Monthly Earnings

**Branch**: `011-creator-earnings` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-creator-earnings/spec.md`

## Summary

Add counted views, the creator dashboard, owner-posted content requests, the owner Earnings page (revenue entry, monthly statement,
closing, payouts) and manual full-access grants. Money logic is pure and gateway-independent: a `RevenueSource` interface
returns one month's four revenue figures, the only implementation for now reads figures an owner typed in, and everything after
that (net, 80/20 pool, shares, rounding, closing, payouts) never knows where the figures came from.

Findings that shaped the plan (all checked in the code):

- **Honest hours already store what counting needs.** `recordHeartbeat` (`src/lib/hours/service.ts`) runs in one transaction and
  upserts `WatchSession` (learner, language, video slug, learner-local day, seconds). The heartbeat notes which day parts crossed
  from below 30 to 30 or more seconds, and a counted view is created **after the heartbeat commits**, in its own try/catch that logs
  a failure. That is exact ("at that moment"), costs nothing on ordinary heartbeats (one crossing per learner, video and day),
  cannot double count, and a counting failure can never touch the learner's hours (a failed SQL statement would otherwise abort the
  whole heartbeat transaction).
- **A free learner can already produce honest seconds.** The heartbeat is refused only when the video is locked
  (`isVideoLocked`), and a free-access video is never locked. So the crossing check must itself require active full access; it
  cannot rely on the heartbeat having been accepted.
- **There is one access rule and it is pure.** `hasFullAccess(subscription, now)` in `src/lib/billing/access.ts`, reached through
  `canWatch`, `markLocked`, `requireVideoAccess` and a handful of pages. Manual grants extend that one function with a third
  input, so every place that decides "full access" (learner site, settings, counted views) agrees by construction.
- **Learner tables point at videos by language and slug, with no foreign key.** `CountedView` is the one new learner-side table
  that stores the video id and the creator at the time, so earnings never join through slugs and survive a video being withdrawn.
- **`cacheComponents` is on.** The dashboard cache uses a `use cache` function with `cacheLife` and `cacheTag`; the role check
  and the actor's own id are resolved outside it and passed in as arguments, so a cached entry can only ever be one creator's.
- **Months are Europe/Warsaw, and the helper exists.** `startOfMonth`/`REVIEW_ZONE` live in `src/lib/review/rules.ts`. They move to
  a small shared `src/lib/time/warsaw.ts` (review re-exports them, no behaviour change) so earnings does not import from review.
- **Spec 10 patterns carry over.** In-memory store pattern for service tests, `requireOwner` on every action, append-only tables
  protected by a database trigger in a follow-up migration, the `dal-boundary` allow-list, and the owner-access scan test.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22 types, React 19.3, Next.js 16.4.5 (App Router, `cacheComponents: true`)

**Primary Dependencies**: existing only: Prisma 7 with `@prisma/adapter-pg`, zod 4. No new runtime dependency. The weekly chart is plain
markup like the design (no chart library). Large products in the split use `BigInt` (built in) so cents never overflow.

**Storage**: PostgreSQL via Prisma. Two migrations: tables and columns; then a follow-up migration with the append-only and
closed-month triggers (the first one can be applied before triggers are added, as in spec 10).

**Testing**: Vitest (unit, jsdom for components) with the in-memory store pattern (`createXService({ store, ... })`). The counting
and split modules are pure and tested directly. Role tests: a creator, a learner and nobody against every owner function, and a
creator reaching another creator's numbers.

**Target Platform**: Vercel, desktop-first web.

**Project Type**: Single Next.js web application (no separate backend).

**Performance Goals**: counting adds no query to a heartbeat that does not cross the threshold and a bounded handful (video and
creator lookup, access facts, one insert, all after the heartbeat has committed) to the one that does; the creator dashboard answers from at most
ten indexed queries run together (listed in `research.md` §10) and is cached for about a minute per creator; the owner statement for one month is a single grouped query plus the stored revenue.

**Constraints**: all money in integer cents with a currency; shares sum exactly to the pool (largest remainder); closed months never
change (service rule plus database trigger); payouts and grants append-only; creators receive only their own numbers (checked in the
data access layer, never only in the UI); no payment gateway calls; every boundary in Europe/Warsaw.

**Scale/Scope**: tens of creators, thousands of learners, up to a few hundred thousand counted views per month at most; six screens
(creator dashboard, owner Earnings, owner Access, owner Requests, plus the new Earnings, Access and Requests entries in the owner nav).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Result | How |
|---|---|---|
| I. Product source of truth | Pass, with a docs task | Dashboard (screen 9) and Earnings (16) are in `docs/product.md`. Manual revenue entry, adjustments, manual grants and owner requests are small additions; the first implementation task updates `docs/product.md` (and Roles) before code. |
| II. Brand behaviours | Pass | No streaks, ranks or "overdue" words; lists end (top five, last five weeks, open requests); copy is short and calm; estimates are called estimates. Tested by a copy scan like spec 10's. |
| III. Honest hours | Pass | Counting reads only `WatchSession` seconds, which already follow honest-hours rules; the counting rule is a pure, tested module. |
| IV. Multi-language | Pass | Counted views and statements are language-agnostic; the dashboard's language line comes from the creator's host language. Arabic blocks, if any, carry `dir` and `lang`. |
| V. Arabic first-class | Pass | Video titles shown on the dashboard may carry Arabic; they use the existing `lang`/`dir` handling. |
| VI. Design fidelity | Pass (constitution v2.1.0) | The creator dashboard and the Earnings statement follow `CreatorDashboard.dc.html` and `OwnerEarnings.dc.html`. The revenue form, adjustments, payout history, close control, Access page and Requests page are owner-only utility screens, which VI (v2.1.0) lets us build from the approved owner components and tokens, provided T062 records them in `docs/design/README.md` afterwards. No learner or creator screen is added without a design. |
| VII. Stack discipline | Pass | Server Components first; client components only for forms and confirmations; `use cache` per the installed Next docs; no new dependency. |
| VIII. Review-gated publishing | Pass | Counted views and the dashboard count only videos that were approved; nothing here changes statuses. |
| IX. Quality and small changes | Pass | Tests listed in Testing; each task is small. |
| X. Privacy and security | Pass | Learner identity is never shown to creators or owners on these pages (counts only); inputs validated with zod; owner actions re-check the role. |
| XI. Roles and permissions | Pass | Every function takes the actor and refuses non-owners (owner functions) or scopes to `actor.id` (creator reads); a role test for each, including a creator reaching another creator's numbers. |
| XII. Money rules | Pass | Integer cents plus currency; 80/20; shares sum exactly to the pool; leftover cents by largest remainder, ties to the earlier-joined creator; estimates labelled; closing locks; corrections are adjustments in a later open month; payouts append-only with reversing records; pure tested module. |
| XIII. Direct video upload | Not touched | |

**Post-design re-check**: unchanged; all principles pass. Two analysis findings were resolved in the design: currency is stored with every amount (XII), and counting runs after the heartbeat commits (III).

## Project Structure

### Documentation (this feature)

```text
specs/011-creator-earnings/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── revenue-source.md
│   ├── server-actions.md
│   └── routes-and-screens.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                  # + CountedView, MonthlyRevenue, RevenueChange, RevenueAdjustment,
│                                                  #   EarningsMonth, CreatorEarning, Payout, AccessGrantEvent, ContentRequest;
│                                                  #   User.manualAccessAt
└── migrations/
    ├── <ts>_creator_earnings/                     # tables and columns
    └── <ts>_creator_earnings_triggers/            # append-only + closed-month triggers

src/lib/
├── time/warsaw.ts                                 # zone, month key, month range, start of month (moved from review/rules)
├── billing/access.ts                              # hasFullAccess/canWatch/markLocked gain a `manual` input (pure)
├── billing/subscription.ts                        # getFullAccess(userId): subscription + manual grant, cached per request
├── hours/service.ts                               # recordHeartbeat: notes day parts that cross 30 seconds; counts them after the commit
├── earnings/
│   ├── counting.ts                                # pure: crossesThreshold, countsAsView (access, own video)
│   ├── split.ts                                   # pure: net, pool, largest-remainder shares (BigInt inside)
│   ├── months.ts                                  # pure: month keys, ranges, weeks, next payout date
│   ├── rules.ts                                   # validation: cents, month, reference, states (open/closed/paid)
│   ├── revenue-source.ts                          # RevenueSource interface + ManualRevenueSource
│   ├── record-view.ts                             # records a counted view after the heartbeat commits (own queries, own try/catch)
│   ├── service.ts                                 # createEarningsService({ store, revenue, now, readDashboard }) owner + creator functions
│   ├── store.ts                                   # Prisma store (row locks, grouped counts)
│   ├── dashboard.ts                               # cached per-creator dashboard read ('use cache', cacheTag); imported only by instance.ts
│   ├── instance.ts  messages.ts  format.ts  actions.ts
├── grants/                                        # service, store, instance, messages, actions (owner only)
└── requests/                                      # service, store, instance, messages, actions

src/components/
├── creator/                                       # StatTile, WeeklyViews, EarningsCard, TopVideos, AnswerBar, RequestsList
├── owner/                                         # RevenueForm, StatementCard, CreatorSharesTable, CloseMonthButton,
│                                                  # MarkPaidButton, AdjustmentForm, GrantForm, GrantHistory, RequestForm, RequestsTable
└── screens/                                       # CreatorDashboardScreen (replaces CreatorScreen), OwnerEarningsScreen,
                                                   # OwnerAccessScreen, OwnerRequestsScreen

src/app/
├── (creator)/creator/page.tsx                     # dashboard
└── (panel)/owner/{earnings,access,requests}/page.tsx

tests/
├── helpers/earnings-memory.ts                     # in-memory store, revenue source and clock
└── unit/earnings/, unit/grants/, unit/requests/   # see Testing
```

**Structure Decision**: One Next.js app. Pure modules (`counting`, `split`, `months`, `rules`) are separate from the service and store, the service
takes a store, a `RevenueSource` and the cached dashboard reader as inputs (like spec 10), and only `store.ts` files, `record-view.ts` and the
existing hours service touch Prisma (`dal-boundary` allow-list updated). Learner-facing code is unchanged except the access function's third input.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New `src/lib/time/warsaw.ts` shared module | Earnings and review both need Warsaw months | Importing review's rules from earnings couples two unrelated features; copying the zone code risks drifting month boundaries. |
