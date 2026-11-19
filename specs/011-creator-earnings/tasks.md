---
description: "Task list for Creator Statistics and Monthly Earnings"
---

# Tasks: Creator Statistics and Monthly Earnings

**Input**: Design documents in `/specs/011-creator-earnings/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: Specs 7 (billing and access), 5 (honest hours), 8, 9 and 10 applied (roles, creator panel, owner panel, `src/lib/session.ts`, `src/lib/review/`, `src/lib/creators/`).

**Tests**: Included. Constitution IX asks for tests of core logic, XI for role tests including a creator trying to reach another creator's data, XII for a pure, tested money module. Tests live in `tests/unit/` and use the in-memory store pattern (`createXService({ store, ... })`).

**Organization**: By user story in priority order. Schema, the access rule's `manual` input, the shared pure rules and the Warsaw time helper are Foundational because every story needs them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US6, as in spec.md (US1 counted views, US2 owner statement, US3 creator dashboard, US4 closing and payouts, US5 manual access, US6 content requests)
- Before writing Next.js code read the relevant guide in `node_modules/next/dist/docs/01-app/`: caching in `03-api-reference/01-directives/use-cache.md`, `03-api-reference/04-functions/cacheLife.md`, `cacheTag.md` and `updateTag.md`; server actions in `02-guides/forms.md` and `02-guides/data-security.md`; pages in `01-getting-started/03-layouts-and-pages.md`.
- Pages that read the session render behind `<Suspense fallback={<PageFallback />}>` (as `src/components/screens/OwnerCreatorsScreen.tsx` is used) because of `cacheComponents`.
- Store files (`store.ts`) are the only place Prisma is queried: add each new one to the `allowed` list in `tests/unit/dal-boundary.test.ts`.
- Money is integer cents everywhere, always stored with a currency; never use floating-point arithmetic on an amount. Every month, week and day boundary is Europe/Warsaw.
- Counting a view never runs inside the heartbeat transaction: it happens after the commit and a failure is logged and swallowed, so a learner's hours are never affected (constitution III).
- The new owner screens (Earnings additions, Access, Requests) are owner-only utility screens under constitution VI v2.1.0: built from the approved owner components and tokens, recorded in `docs/design/README.md` by T062.

## Phase 1: Setup

- [X] T001 [P] Update `docs/product.md` first (constitution I): under screen 16 Earnings add "monthly revenue (gross, VAT, payment fees, refunds) is entered by an owner until a payment gateway is chosen; corrections to a closed month are adjustments in the open month, shared 80/20"; under Roles add that owners can grant and remove full access to any account by hand, with every grant recorded; under screen 9 add that open requests from Instik are posted by owners; and add the Requests and Access owner pages to the Owner panel list as additions to screens 13 to 16. Keep the wording short and in the file's existing style. **This task blocks Phase 2** (constitution I: no feature work before `docs/product.md` includes it).
- [X] T002 [P] Add path helpers to `src/lib/routes.ts`: `ownerEarningsPath(month?: string)` (`/owner/earnings`, or `/owner/earnings?month=YYYY-MM`), `ownerAccessPath()` (`/owner/access`) and `ownerRequestsPath()` (`/owner/requests`); `creatorPath()` already exists for the dashboard. Add cases to `tests/unit/routes.test.ts`.
- [X] T003 [P] Create `src/lib/time/warsaw.ts` (pure): `APP_ZONE = "Europe/Warsaw"`, `startOfMonth(now)`, `monthKeyOf(instant)` (`"YYYY-MM"` in Warsaw), `monthRange(key)` returning `{ start, end }` instants (end exclusive), `previousMonth(key)`, `nextMonth(key)`, `isMonthKey(text)` (`^\d{4}-(0[1-9]|1[0-2])$`), `hasMonthEnded(key, now)` and `warsawDayOf(instant)` (`"YYYY-MM-DD"`). Move `REVIEW_ZONE`/`startOfMonth` out of `src/lib/review/rules.ts` and re-export them from there so nothing in review changes. Add `tests/unit/time/warsaw.test.ts`: month boundaries at the exact Warsaw midnight in winter (UTC+1) and summer (UTC+2), the last second of a month, the day the clocks change in March and October, 28/29-day February, December to January, and a counted instant at 23:30 UTC on the last day of a month (already the next month in Warsaw).

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: schema, triggers, the one access rule with manual grants, shared pure rules.

**⚠️ CRITICAL**: no user story work starts before this phase is done.

- [X] T004 Update `prisma/schema.prisma` exactly per `data-model.md`. `User.manualAccessAt DateTime?` plus back-fields `accessEvents AccessGrantEvent[] @relation("GrantedTo")` and `accessGiven AccessGrantEvent[] @relation("GrantedBy")`. Enums: `RevenueSourceKind { MANUAL GATEWAY }`, `MonthStatus { OPEN CLOSED }`, `PayoutKind { PAID REVERSAL }`, `GrantKind { GRANTED REMOVED }`, `GrantReason { TESTING CREATOR GIFT OTHER }`, `RequestStatus { OPEN CLOSED }`. Models: `CountedView` (`id` cuid; `userId String?` relation to `User` with `onDelete: SetNull`; `videoId String`; `creatorId String?` relation to `User` with `onDelete: SetNull` (name the relations); `day DateTime @db.Date`; `countedAt DateTime`; `monthKey String`; `warsawDay DateTime @db.Date`; `@@unique([userId, videoId, day])`; indexes `(creatorId, monthKey)`, `(creatorId, warsawDay)`, `(videoId, monthKey)`); `MonthlyRevenue` (`month String @id`; `currency String`; `grossCents`, `vatCents`, `feesCents`, `refundsCents Int` each "0 to 1,000,000,000 (checked in code); whole cents"; `source RevenueSourceKind`; `version Int` "starts at 1; each save adds 1 and must match the version the editor loaded"; `updatedById String?`; `updatedAt`); `RevenueChange` (`id`, `month`, the four cents values as saved, `version`, `byId String?`, `at`; "append-only"); `RevenueAdjustment` (`id`, `month`, `amountCents Int` "Signed, not zero, within ±1,000,000,000", `currency String` "The month's currency (`\"EUR\"`), copied from that month's revenue record when the adjustment is entered", `note String` "1 to 200 characters (checked in code)", `byId String?`, `at`; "append-only"); `EarningsMonth` (`month String @id`, `status MonthStatus`, `closedAt DateTime?`, `closedById String?`, `currency`, `grossCents`, `vatCents`, `feesCents`, `refundsCents`, `adjustmentsCents`, `netCents`, `poolCents`, `instikCents`, `totalViews Int`); `CreatorEarning` (`id`, `month`, `creatorId String?` set null on user delete, `creatorName String` "Snapshot at closing", `views Int`, `earningsCents Int`, `currency String` "The month's currency, copied at closing", `@@unique([month, creatorId])`); `Payout` (`id`, `month`, `creatorId String?`, `kind PayoutKind`, `amountCents Int` "Always positive", `currency String` "Copied by the service from the closed month (`EarningsMonth.currency`), never from input; a reversal copies the currency of the record it reverses", `reference String` "1 to 120 characters", `byId String?`, `at`, `reversesId String?`); `AccessGrantEvent` (`id`, `userId String` cascade on user delete, `kind GrantKind`, `reason GrantReason`, `note String?` "Up to 200 characters", `byId String?` set null, `at`; index `(userId, at)`); `ContentRequest` (`id`, `stage String`, `topic String`, `text String` "1 to 200 characters", `status RequestStatus`, `createdById String?`, `createdAt`, `updatedAt`, `closedAt DateTime?`; index `(status, createdAt)`). Name every relation that links to `User` twice, as spec 10 did for `CreatorPauseEvent`.
- [X] T005 Create the first migration with `npm run db:migrate -- --name creator_earnings` and run `npx prisma generate`. Check the generated SQL creates the tables and the unique `("userId","videoId","day")` index on `"CountedView"`.
- [X] T006 Create the follow-up migration by hand at `prisma/migrations/<timestamp later than the previous>_creator_earnings_triggers/migration.sql`, in the style of `prisma/migrations/20261113150600_owner_review_pause_trigger/migration.sql` (a separate migration because the first is applied before triggers are added). Add row triggers that raise an exception: (a) `"RevenueChange"`, `"RevenueAdjustment"`, `"Payout"`, `"AccessGrantEvent"` and `"CreatorEarning"` refuse UPDATE and DELETE, with two allowed exceptions: a DELETE when the owning user row is gone (cascade), and an UPDATE that changes only the `creatorId` or `byId` column from a value to NULL (the effect of `ON DELETE SET NULL`); (b) `"RevenueAdjustment"` also refuses INSERT when `"EarningsMonth"` for that `"month"` has `status = 'CLOSED'`; (c) `"MonthlyRevenue"` refuses UPDATE and DELETE when `"EarningsMonth"` for that `"month"` is CLOSED; (d) `"EarningsMonth"` refuses UPDATE and DELETE once `OLD."status" = 'CLOSED'`; (e) `"CountedView"` refuses UPDATE and DELETE with the same two exceptions as (a) (a DELETE when the owning user row is gone, and an UPDATE that only changes `userId` or `creatorId` from a value to NULL). Apply with `npm run db:deploy`.
- [X] T007 [P] Create `tests/unit/earnings/migration-triggers.test.ts` reading the triggers migration SQL (pattern of `tests/unit/migration-append-only.test.ts`): it exists, each trigger above is created after its table, uses `BEFORE UPDATE OR DELETE` (or `BEFORE INSERT` for the closed-month adjustment check) `FOR EACH ROW`, raises an exception, the SET NULL and cascade exceptions are present, and the `CountedView` trigger refuses UPDATE and DELETE except those.
- [X] T008 Add the manual input to the one access rule in `src/lib/billing/access.ts` (stays pure): `hasFullAccess(subscription, now, manual = false)` returns true when `manual` is true or the subscription gives access as today; `canWatch(video, subscription, now, manual = false)` and `markLocked(videos, subscription, now, manual = false)` pass it through. Extend `tests/unit/billing/access-rule.test.ts`: manual true with no subscription, manual true with an ended subscription, manual false changes nothing, a stale subscription plus manual still has access.
- [X] T009 Needs T005 (so `User.manualAccessAt` exists in the generated client) and T008. In `src/lib/billing/subscription.ts` add `getFullAccess(userId)` (wrapped in `cache` like `getSubscription`): reads the subscription row and `User.manualAccessAt` and returns `{ subscription, manual: boolean, full: boolean }` using `hasFullAccess`. Use it everywhere access is decided: `requireVideoAccess` (pass `manual` into `canWatch`; keep the stale-subscription Stripe re-sync only when there is no manual grant), `src/components/screens/HostVideos.tsx`, `src/components/screens/LibraryProgress.tsx`, `src/components/screens/WatchScreen.tsx`, `src/components/billing/FullAccessSlot.tsx`, `src/app/billing/start/route.ts` (an account that already has full access, paid or granted, goes to settings), `src/app/billing/return/route.ts` and `src/app/(shell)/settings/page.tsx` (when `manual` is true and there is no subscription, show a short note "Full access from Instik" instead of the plan section). Removing or granting never touches the `Subscription` row. Update `tests/unit/billing/watch-gate.test.tsx`, `locked-video.test.tsx` and `full-access-action.test.tsx` mocks for the new reader and add a case: a granted account is not locked.
- [X] T010 [P] Create `src/lib/earnings/rules.ts` (pure) and `src/lib/earnings/format.ts` (pure): `parseEuros(text)` converting text such as `"3000"`, `"3,000.50"` or `"12.5"` to whole cents by string handling only (never `parseFloat` times 100), refusing more than two decimals, non-numbers and negatives (a separate `parseSignedEuros` allows a leading minus for adjustments); `validateRevenue(figures)` enforcing each figure "0 to 1,000,000,000 (checked in code); whole cents"; `validateAdjustment({ amountCents, note })` enforcing "Signed, not zero, within ±1,000,000,000" and note "1 to 200 characters"; `validateReference(text)` "1 to 120 characters"; `formatEuros(cents)` ("€2,300.00", "−€561.00" for negatives) by integer math; `formatPercent(views, total)` to one decimal for display only; `nextPayoutDate(now)` the 5th of the next calendar month in Warsaw. Add `tests/unit/earnings/rules.test.ts` and `tests/unit/earnings/format.test.ts` including `"0.1" + "0.2"` style inputs that would break floats, `"1e3"`, `"-5"`, 3 decimals, 1,000,000,000 and 1,000,000,001 cents, and the 5th rolling over December to January.

**Checkpoint**: both migrations applied, `npm run typecheck` and `npm test` green, learner access unchanged for everyone without a grant.

---

## Phase 3: User Story 1 - Count views honestly (Priority: P1) 🎯 MVP

**Goal**: a learner with active full access who reaches 30 honest seconds on a video in a day earns that video's creator one counted view, once per learner, video and day, judged on access at that moment.

**Independent Test**: with test learners (paid, free, lapsed, manually granted, the creator themselves), drive heartbeats of 10, 29, 30 and 120 seconds, twice in one day and again the next day, and check which `CountedView` rows exist (unit tests; no dashboard or earnings page).

### Tests for User Story 1 (write first, they fail before the code)

- [X] T011 [P] [US1] Create `tests/unit/earnings/counting.test.ts` for the pure rule: `crossesThreshold(before, added)` is true only when `before < 30 <= before + added` (29 + 1 yes; 0 + 30 yes; 28 + 5 yes; 30 + 5 no; 31 + 1 no; 0 + 29 no; added 0 no); `countsAsView({ learnerId, creatorId, access })` is false for a free learner, a lapsed subscriber (ended or stale), the creator's own video (learner id equals creator id), and a video with no creator; true for an active subscriber, a trialing or past-due one (as `hasFullAccess`), and a manually granted account; a free-access video does not change the answer.
- [X] T012 [P] [US1] Create `tests/unit/earnings/record-view.test.ts` for `recordCountedViewIfCrossed` with a fake database client (follow how `tests/unit/hours/` mocks the database and `tests/helpers/hours-fixtures.ts`): one view at the crossing heartbeat with `monthKey` and `warsawDay` computed in Warsaw (including 23:30 UTC on the last day of a month); no view on later heartbeats the same day (the unique key is hit and nothing throws); a new day makes a new view; two day parts (a heartbeat split by midnight) judged separately; a free learner, a lapsed learner and the creator themselves make none; a granted account makes one; access gained after the crossing does not back-credit the day; a missing database video makes none; **a database error while counting is logged and swallowed (the function resolves, never throws, and the log line contains no learner id)**. Second file for this task: add to the heartbeat tests under `tests/unit/hours/` (the fake database of `tests/helpers/hours-fixtures.ts`): **when `recordCountedViewIfCrossed` rejects or throws, `recordHeartbeat` still returns exactly the same `ok` result and the learner's `WatchSession`, progress and totals are written as without counting** (a counting failure never affects Hours); when the heartbeat transaction fails or is rejected, counting is not called at all; counting is called once, after the transaction has committed, with only the crossed day parts; a heartbeat that does not cross 30 seconds does not call it.

### Implementation for User Story 1

- [X] T013 [US1] Create `src/lib/earnings/counting.ts` (pure, no `server-only`): `COUNTED_VIEW_SECONDS = 30`, `crossesThreshold(before, added)` and `countsAsView(input)` per T011, using `hasFullAccess` from `src/lib/billing/access.ts`.
- [X] T014 [US1] Create `src/lib/earnings/record-view.ts`: `recordCountedViewIfCrossed(crossings, nowMs)`, where each crossing is `{ userId, languageCode, videoSlug, day, secondsBefore, secondsAfter }`. It runs **after the heartbeat has committed**, with its own queries through `db()`, and wraps everything in one `try/catch` that logs a failure with `console.error` (no learner id in the message) and returns normally. For each crossing where `crossesThreshold(secondsBefore, secondsAfter - secondsBefore)` holds, read the `Video` by `(languageCode, slug)` selecting `id` and `host.userId` as `creatorId`, the learner's `Subscription` facts and `User.manualAccessAt`; if `countsAsView` is true, insert with `createMany({ data, skipDuplicates: true })` setting `countedAt = new Date(nowMs)`, `monthKey = monthKeyOf(...)` and `warsawDay = warsawDayOf(...)` once. This file queries Prisma, so add `src/lib/earnings/record-view.ts` to the `allowed` list in `tests/unit/dal-boundary.test.ts` with a one-line reason.
- [X] T015 [US1] In `src/lib/hours/service.ts` `recordHeartbeat`: have the `watchSession.upsert` return the updated row; for each day part compute `secondsBefore = row.seconds - part.seconds` and `secondsAfter = row.seconds` and collect the parts where `crossesThreshold` holds into a `crossings` list (no counting query inside the transaction). After `db().$transaction(...)` resolves with `ok: true` and `crossings` is not empty, call `recordCountedViewIfCrossed(crossings, now)` (it never throws; still `await` it inside no `try` of your own). The heartbeat's result, validation and totals do not change, and a learner is never told about counted views. Keep the words `lib/billing` out of `src/lib/hours/service.ts`, comments included: `tests/unit/billing/hours-untouched.test.ts` fails if they appear. Needs T012 (the heartbeat tests) and T014.

**Checkpoint**: counted-view rules proven end to end in tests; US1 is shippable on its own (rows are recorded; nothing displays them yet).

---

## Phase 4: User Story 2 - Owner sees a month's statement and each creator's share (Priority: P1)

**Goal**: an owner enters a month's revenue figures and sees net revenue, the 80/20 split, total counted views and each creator's counted views, share and earnings, labelled as estimates while the month is open.

**Independent Test**: enter gross €3,000.00, VAT €561.00, fees €96.00, refunds €43.00 for a month with 3,680, 2,300, 1,840 and 1,380 counted views: net €2,300.00, pool €1,840.00, Instik €460.00, earnings €736.00, €460.00, €368.00 and €276.00.

### Tests for User Story 2

- [X] T016 [P] [US2] Create `tests/unit/earnings/split.test.ts` for the pure `computeStatement`: the €3,000/€561/€96/€43 example above; net floors at zero when VAT, fees and refunds exceed gross; pool = `floor(net × 80 / 100)` and Instik = `net − pool` (so an odd cent goes to Instik); a three-way split of 100 cents with 1/1/1 views sums to exactly 100 and gives the extra cent by the fixed rule (largest remainder first, ties to the creator who joined earlier, then by id); earnings always sum to exactly the pool when total views > 0 and never exceed it (property test over many random cases, using a seeded generator); zero total views gives no creator lines and the pool unallocated; an adjustment (positive and negative) changes net before the split; amounts around 10^9 cents with views around 10^7 stay exact (BigInt inside; assert against an independent BigInt calculation); the result is identical regardless of input order of creators.
- [X] T017 [P] [US2] Create `tests/unit/earnings/revenue-source.test.ts`: `ManualRevenueSource.getMonthRevenue` returns the entered figures or `null`; a fake second source holding the same numbers gives a byte-identical `computeStatement` result (SC-011); `split.ts` does not import `revenue-source.ts` (read the file text); and **nothing under `src/lib/earnings/` imports a payment provider, `fetch`-style network module or Stripe code** (read the files: FR-031, no gateway calls, no money is ever sent).
- [X] T018 [US2] Create `tests/helpers/earnings-memory.ts`: an in-memory `EarningsStore` (revenue rows with versions and change log, adjustments, counted views per creator and month, creators with join dates and names, months, earnings, payouts) with a transaction that rolls back on throw and a row lock that serialises two callers (as `tests/helpers/review-memory.ts` does), plus a fixed clock. It is extended in US3 and US4.
- [X] T019 [US2] Create `tests/unit/earnings/statement-service.test.ts` for `getStatement`, `listMonths` and `saveRevenue`: owner gets the figures and shares; no revenue entered returns "not entered" with counted views and no euro amounts; saving validates (negative, three decimals, over 1,000,000,000 cents refused with plain messages); a second save with the old `expectedVersion` is refused with the "Figures changed. Reload to see them." message and the first save stays; every save appends a `RevenueChange` (who, when, figures); saving a closed month is refused; open-month figures are labelled estimated; a creator, a learner and nobody get `ForbiddenError` from every function with no data and no store call.

### Implementation for User Story 2

- [X] T020 [P] [US2] Create `src/lib/earnings/split.ts` (pure): `computeStatement({ revenue, adjustmentsCents, creators: { id, name, joinedAt, views }[] })` returning `{ netCents, poolCents, instikCents, totalViews, lines: { id, name, views, shareBasisPoints, earningsCents }[] }` per `research.md` §5, using `BigInt` for `pool × views` and the remainder; document the leftover-cent rule in a comment and in the page help text.
- [X] T021 [P] [US2] Create `src/lib/earnings/revenue-source.ts`: the `MonthRevenue` and `RevenueSource` types from `contracts/revenue-source.md` and `ManualRevenueSource` (reads through the `EarningsStore`; no network, no gateway). Nothing in `split.ts` imports this file.
- [X] T022 [US2] Create `src/lib/earnings/service.ts`: `createEarningsService({ store, revenue, now })` with the `EarningsStore` and `EarningsTx` interfaces and the owner functions `getStatement(actor, month)`, `listMonths(actor)` (newest first, at most 24) and `saveRevenue(actor, input)` per `contracts/server-actions.md`. Every function calls `isOwner(actor)` first and throws `ForbiddenError` before touching the store; `saveRevenue` runs in one transaction that locks the month row, refuses a closed month, checks `expectedVersion`, writes the row (`source = MANUAL`, version + 1, `updatedById`) and a `RevenueChange`. Messages in `src/lib/earnings/messages.ts` are short, calm and say what to do next (no "failed", "invalid", "error" or shaming words).
- [X] T023 [US2] Create `src/lib/earnings/store.ts` (Prisma; the only file here that queries): month list, revenue read, row-locked upsert (`SELECT … FOR UPDATE` on the month), grouped counts `countedView.groupBy({ by: ["creatorId"], where: { monthKey } })` joined with creator names and join dates, `RevenueChange` insert. Add `src/lib/earnings/store.ts` to the `allowed` list in `tests/unit/dal-boundary.test.ts`.
- [X] T024 [US2] Create `src/lib/earnings/instance.ts` (real store, `ManualRevenueSource`, `() => new Date()`) and `src/lib/earnings/actions.ts` (`"use server"`): `saveRevenue` calling `requireOwner` first, parsing input with zod (euro text per figure, `expectedVersion`, month key via `isMonthKey`), converting with `parseEuros`, calling the service and returning a result for the form.
- [X] T025 [P] [US2] Create the owner components in `src/components/owner/`: `RevenueForm.tsx` (client; four labelled euro fields, hidden `expectedVersion`, a clear Save button, shows the stale-version message and a "Saved" note), `StatementCard.tsx` (the design's gross, VAT, fees, refunds, net rows; the 80% pool and 20% Instik tiles; total counted views with the design's explanation sentence; a short help sentence on how leftover cents are given out ("When a split does not divide into whole cents, the extra cents go to the creators with the largest remainders, earlier-joined first."); and, **when net revenue is floored at €0.00, the line "Net revenue is €0.00 this month because VAT, fees and refunds are as much as the gross revenue. Nobody earns this month."**), `CreatorSharesTable.tsx` (Creator, Counted views, Share, Earnings, Payout columns as designed; the Payout column and button are filled in by US4). Colour tokens only, 44px targets, "estimated" wording while open.
- [X] T026 [US2] Create `src/components/screens/OwnerEarningsScreen.tsx` (`requireOwner(ownerEarningsPath())`, month select with "closed"/"open" labels, then revenue form or "not entered yet" state, statement and shares) and `src/app/(panel)/owner/earnings/page.tsx` (metadata `robots: { index: false }`, Suspense with `PageFallback`, reads `searchParams.month`, falls back to the current Warsaw month on a bad key). Add the "Earnings" link to `src/components/owner/OwnerNav.tsx` after Creators, following `docs/design/OwnerEarnings.dc.html`, and update `tests/unit/OwnerNav.test.tsx`.
- [X] T027 [US2] Create `tests/unit/earnings/OwnerEarningsScreen.test.tsx`: the example statement renders net, pool, Instik and four creator rows with percentages and euros; no-revenue state shows no euro amounts; **a month whose VAT, fees and refunds equal or exceed gross shows net €0.00 with the "Net revenue is €0.00 this month because…" explanation and no creator earnings**; the leftover-cent help sentence is present; open months say "estimated"; the revenue form posts euro text and shows the stale message; no learner names or emails appear anywhere. Extend `tests/unit/owner-access.test.ts`: add the earnings service to the "has a check for every function" pattern so a creator, a learner, a paused creator and nobody are refused by every owner function and the store is never reached, and extend the "each exported action calls requireOwner" list with `src/lib/earnings/actions.ts`.

**Checkpoint**: an owner can enter revenue and read a correct estimated statement; US2 works without the dashboard or closing.

---

## Phase 5: User Story 3 - Creator sees their own dashboard (Priority: P1)

**Goal**: a creator sees, as designed, their video counts, this month's counted views, watch hours, unique learners and average completion, counted views per week, earnings, top videos with فاهم؟ answers and requests, and nothing about anyone else.

**Independent Test**: sign in as a creator with known videos, counted views, watch sessions and answers and check every tile, the chart, the table and the earnings card against the known data; then as a second creator and confirm none of the first creator's numbers appear.

### Tests for User Story 3

- [X] T028 [P] [US3] Create `tests/unit/earnings/months.test.ts` for the pure helpers in `src/lib/earnings/months.ts`: `lastFiveWeeks(now)` returns five Monday-based Warsaw weeks oldest first with the current one marked in progress (including a Sunday late evening and the clocks-change week); `bucketByWeek(days, weeks)` sums counted views per week and ignores days outside them; `monthOfDay` agrees with `warsawDayOf`.
- [X] T029 [P] [US3] Extend `tests/helpers/earnings-memory.ts` with creators' videos, watch sessions, progress rows and answers, and create `tests/unit/earnings/dashboard-service.test.ts` for `getDashboard(actor)`: the spec's 14-video example (10 approved, 2 in review, 1 changes requested, 1 draft) gives Videos uploaded 14, In review 2, Approved 10, Changes requested 1; this month's counted views, watch hours (all learners' seconds on the creator's videos this month, converted to hours, whether or not a view counted), unique learners (distinct learners with a counted view this month, as a number only) and average completion (mean of `min(1, position / duration)`, `watched` = 1, across the creator's videos that at least one learner watched this month; videos nobody watched this month are left out; no such video gives "nothing yet", not 0%); five weekly buckets; top videos at most five by counted views with answer proportions that add to 100; earnings estimate when revenue exists and "not available yet" (no zero) when it does not; last month's final amount from a closed month; a brand-new creator gets zeros and empty states; **a creator never receives another creator's videos, views, earnings or the month's total revenue and pool** (two creators with different data: each dashboard contains only its own numbers, and the result object has no field for the pool or other creators); a learner, an owner who is not a creator, and nobody are refused with `ForbiddenError` and no store call; a paused creator can still read it; the function takes only the actor (no creator id parameter exists). Build the service with a **pass-through `readDashboard`** (a plain function that reads the in-memory store), so these tests never touch `next/cache`.
- [X] T030 [P] [US3] Create `tests/unit/earnings/dashboard-cache.test.ts`: the cached reader `readCreatorDashboard(creatorId, monthKey, minute)` gets its creator id as an argument and tags `creator-stats:<id>` and `creator-requests` (read the file text for `"use cache"`, `cacheLife`, `cacheTag`), the service resolves the id from `actor.id` and never from input, two creators produce different arguments passed to `readDashboard`, **only `src/lib/earnings/instance.ts` imports `src/lib/earnings/dashboard.ts` (scan every file under `src/` for an import of it), and `service.ts` does not import it**.

### Implementation for User Story 3

- [X] T031 [P] [US3] Create `src/lib/earnings/months.ts` (pure) per T028, reusing `mondayOf`, `addDays` and `daysBetween` from `src/lib/hours/days.ts`.
- [X] T032 [US3] Extend `src/lib/earnings/store.ts` with the dashboard reads, all filtered by one `creatorId` and all indexed: video counts by status (`Video` joined through `Host.userId`, excluding soft-deleted drafts consistently with `src/lib/content/creator-reads.ts`); counted views by `warsawDay` over the last five weeks; distinct learner count for the month; watch seconds for the creator's videos in the month through one `$queryRaw` joining `"Video"` and `"WatchSession"` on `("languageCode","slug") = ("languageCode","videoSlug")` with `WatchSession.day` inside the month's date range (a learner-day label belongs to the month its date falls in); completion from `VideoProgress` for learners with a `WatchSession` that month; top videos with `ComprehensionAnswer` counts grouped by answer; the creator's own closed `CreatorEarning` and `Payout` state (never another creator's). Together with the month's per-creator counted views (an aggregate used only inside the service to compute this creator's share, never returned) and the revenue read, the dashboard issues the ten reads listed in `research.md` §10, run together.
- [X] T033 [US3] Create `src/lib/earnings/dashboard.ts`: `readCreatorDashboard(creatorId, monthKey, minute)` as a `"use cache"` function with `cacheLife({ revalidate: 60, expire: 300 })` and `cacheTag("creator-stats:" + creatorId, "creator-requests")`; arguments are plain strings only. **It is a dependency of the service, not a public helper:** `createEarningsService({ store, revenue, now, readDashboard })` takes it as an input, `src/lib/earnings/instance.ts` is the only file that imports `dashboard.ts` and passes it in, and `service.ts` never imports it. Add `getDashboard(actor)` to `createEarningsService` in `src/lib/earnings/service.ts`: refuse unless `actor.role === "creator"` or `actor.isCreator`, take the creator id from `actor.id`, compute the earnings estimate with `computeStatement` for the current month (revenue from the `RevenueSource`; "not available yet" when `null`), and attach last month's final amount with paid date or "Payment pending" and `nextPayoutDate(now)`. The returned type must contain no field for other creators, the total pool or total views. The screen calls `getDashboard` through `src/lib/earnings/instance.ts`; a read needs no server action.
- [X] T034 [P] [US3] Create the creator components in `src/components/creator/`: `StatTile.tsx`, `WeeklyViews.tsx` (div bars as designed, current week in coral fill with ink label, `role="img"` with an `aria-label` plus a visually available text list of the five numbers), `EarningsCard.tsx` (navy card: "Earnings · {Month} (estimated)", last month final with "paid {date}" or "Payment pending", next payout, the design's explanation paragraph; "Not available yet" when there is no estimate), `AnswerBar.tsx` (teal, sun, coral segments with a text alternative "mostly 70%, some of it 22%, not yet 8%"), `TopVideos.tsx` (table with the design's columns and the legend sentence including the words, not only colours), `RequestsList.tsx` (the design's list; calm empty state "No requests right now."). Tokens only, no raw colours; target-language titles carry `lang`/`dir`.
- [X] T035 [US3] Replace `src/components/screens/CreatorScreen.tsx` with the dashboard per `docs/design/CreatorDashboard.dc.html`: heading "Welcome back, {first name}" (fall back to "Welcome back"), "{Month Year} · {language name}", "Upload a video" button, the two tile rows (the average completion caption reads "Across videos watched this month", the other tiles "This month"), chart beside the earnings card, top videos, requests. Keep `requireCreator(creatorPath())`; render calm empty states for no approved videos or no views. No ranks, comparisons, streak language or "overdue". Leave `src/app/(creator)/creator/page.tsx` as is (Suspense + `PageFallback`).
- [X] T036 [US3] Create `tests/unit/earnings/CreatorDashboardScreen.test.tsx`: renders the design's figures for known data, five bars with the current week marked and a text alternative, earnings "estimated" while open and "not available yet" without revenue, the answer bar's accessible text, empty states for a new creator, no email or learner name in the output, and update `tests/unit/panel-pages.test.tsx` (the creator page no longer shows the placeholder text).

**Checkpoint**: a creator sees their own full dashboard; US1 + US2 + US3 are the minimum useful product.

---

## Phase 6: User Story 4 - Owner closes a month and records payouts (Priority: P2)

**Goal**: an owner closes an ended month (locking its numbers), records adjustments in the open month, and marks each creator paid with a reference; creators see Final, Paid or Payment pending.

**Independent Test**: with an ended month and revenue entered, close it, confirm no number can change, mark one creator paid with a reference, and check the other stays unpaid and the creator's dashboard reflects it.

### Tests for User Story 4

- [X] T037 [P] [US4] Create `tests/unit/earnings/close-month.test.ts`: refused before the month has ended in Warsaw (at 23:59:59 on the last day) and allowed at the first instant of the next month; refused with no revenue entered (message says what is missing); closing stores the frozen figures, net, pool, Instik, total views and one `CreatorEarning` per creator with views (name snapshot, **each with the month's currency**) summing to the pool; **closing twice, and two owners closing at once (memory lock), close once and return the same result with `alreadyClosed: true`, with no duplicated rows**; **after closing, `saveRevenue` and `addAdjustment` for that month are refused**, a counted view arriving later (a late heartbeat) or a creator renamed or removed never changes the stored statement; a month with zero counted views closes with no earning lines; non-owners refused.
- [X] T038 [P] [US4] Create `tests/unit/earnings/payouts.test.ts`: `markPaid` stores creator, month, amount **and currency** from the closed earning (never from input; asserting amount and currency equal the `CreatorEarning` row's even when the caller passes other values), the owner and time, and the reference; a reversal stores the same amount and the currency of the record it reverses; refused for an open month, for a creator with zero earnings, for an empty or 121-character reference and when already paid; paid state is `sum(PAID) − sum(REVERSAL) = earnings`; `reversePayout` appends a reversal (positive amount, `reversesId`), refuses a non-paid record and a second reversal, after which `markPaid` works again; records are never edited or deleted (the service exposes no such function); a creator marking themselves paid or a learner is refused; the other creators' rows are untouched.
- [X] T039 [P] [US4] Create `tests/unit/earnings/adjustments.test.ts`: `addAdjustment` only for the current open month, non-zero signed cents, note 1 to 200 characters, appended with who, when and **the month's currency (copied from that month's revenue record; a caller-supplied currency is ignored)**; a positive and a negative adjustment change that month's net before the 80/20 split (a late €43 refund of a closed month reduces the open month's creator pool by €34.40 and Instik's share by €8.60); cancelling a mistake is a new opposite adjustment; refused for a closed month.

### Implementation for User Story 4

- [X] T040 [US4] Extend `src/lib/earnings/service.ts` and the `EarningsStore`/`EarningsTx` interfaces with `addAdjustment` (copying the month's currency from its revenue record), `closeMonth` (lock the `EarningsMonth` row with `SELECT … FOR UPDATE`, create the row if missing, refuse when `!hasMonthEnded(month, now)` or no revenue, return the existing result if already `CLOSED`, otherwise compute with `computeStatement`, write the frozen `EarningsMonth` and the `CreatorEarning` rows (each with the month's currency) and set `status = CLOSED`, `closedAt`, `closedById` in the same transaction), `markPaid` (lock the creator's `CreatorEarning` row; amount and currency taken from it, never from input) and `reversePayout`. Add the calm messages to `src/lib/earnings/messages.ts` ("Close {Month}? This locks its numbers." and "Payment pending", never "overdue" or "failed").
- [X] T041 [US4] Extend `src/lib/earnings/store.ts` with the transactional pieces for T040 (row locks, `EarningsMonth` and `CreatorEarning` inserts, `Payout` inserts, adjustment inserts, payout state per creator and month; the payout history query returns the latest 100 records) and make `getStatement` read frozen numbers for a closed month and `computeStatement` for an open one.
- [X] T042 [US4] Extend `src/lib/earnings/actions.ts` with `addAdjustment`, `closeMonth`, `markPaid` and `reversePayout` (each calls `requireOwner` first, validates with zod, never takes an actor or amount from input). After each, call `updateTag` for `creator-stats:<id>` of each creator affected (`closeMonth` and `addAdjustment`: every creator with views that month; payouts: that creator).
- [X] T043 [P] [US4] Create `src/components/owner/CloseMonthButton.tsx` (client; a calm confirmation "Close {Month}? This locks its numbers. Corrections go in as adjustments in the next open month."; disabled with a reason before the month has ended or without revenue), `MarkPaidButton.tsx` (client; reference field 1 to 120 characters; "Mark as paid"), `PayoutHistory.tsx` (the latest 100 records with who, when, amount and currency, reference, and the plain note "Showing the latest 100 records." when there are more; reversal button "Undo payment"), and `AdjustmentForm.tsx` (client; signed euros, note up to 200 characters; only on the open month). 44px targets, tokens only.
- [X] T044 [US4] Update `src/components/owner/CreatorSharesTable.tsx` and `src/components/screens/OwnerEarningsScreen.tsx`: for a closed month hide the revenue form and show "Closed" with when and by whom, the Paid or Unpaid badge per creator (Paid with date as the design shows), the Mark as paid button for unpaid rows, the payout history and the design's footer sentence ("Payouts are sent by bank transfer for now. Closing a month locks its numbers; {Month} closes on 1 {next month}."); for an open month show the adjustment form and list.
- [X] T045 [US4] Update `src/components/creator/EarningsCard.tsx` and the dashboard service data: last month's amount shows "final", with "paid {date}" once paid or "Payment pending"; the card never shows another month's or creator's payout. Add cases to `tests/unit/earnings/dashboard-service.test.ts` and `CreatorDashboardScreen.test.tsx`.
- [X] T046 [US4] Extend `tests/unit/owner-access.test.ts` so the new service functions (`addAdjustment`, `closeMonth`, `markPaid`, `reversePayout`) are in the every-function check and `src/lib/earnings/actions.ts` still passes "each exported action calls requireOwner".

**Checkpoint**: months can be closed and paid; closed numbers never change.

---

## Phase 7: User Story 5 - Owner grants and removes full access by hand (Priority: P2)

**Goal**: an owner gives or removes full access for any existing account by email, every change recorded, and that access counts like paid access, including for counted views.

**Independent Test**: grant a test account, check full-access videos unlock and 30 seconds of watching makes one counted view, remove the grant and check access and later counting stop while the earlier view remains.

### Tests for User Story 5

- [X] T047 [P] [US5] Create `tests/unit/grants/grants-service.test.ts` with an in-memory grants store: `grantAccess` sets `manualAccessAt` and appends a `GRANTED` event (reason one of TESTING, CREATOR, GIFT, OTHER; note up to 200 characters) in one transaction; refused for an unknown email ("No account with that email yet." and nothing created), a reason outside the four, a note over 200 characters, an already granted account; `removeAccess` clears the flag and appends `REMOVED`, refused when there is no active grant; **removing a grant never changes the account's subscription**, and granting never creates a payment or subscription; events are never edited or deleted (the service has no such function); `listGrants` returns active grants then recent events (at most 100); every function refuses a creator, a paused creator, a learner and nobody with `ForbiddenError`, no data and no store call; the email is trimmed and lower-cased before lookup.
- [X] T048 [P] [US5] Create `tests/unit/grants/grant-access.test.ts` proving the same access function serves grants: `canWatch` and `markLocked` unlock a full-access video for a granted free account and lock it again after removal; `hasFullAccess(null, now, true)` is true; a granted account's watching makes a counted view via `recordCountedViewIfCrossed` (fake tx), and after removal later watching makes none while the earlier view stays; a granted creator watching their own video makes none.

### Implementation for User Story 5

- [X] T049 [US5] Create `src/lib/grants/service.ts` (`createGrantsService({ store, now })` with `grantAccess`, `removeAccess`, `listGrants`; `isOwner` first), `src/lib/grants/store.ts` (Prisma; one transaction sets or clears `User.manualAccessAt` and writes the `AccessGrantEvent`; finds the account by lower-cased email), `src/lib/grants/instance.ts`, `src/lib/grants/messages.ts` (calm sentences) and `src/lib/grants/actions.ts` (`"use server"`, `requireOwner`, zod: email, reason enum, note up to 200 characters; never an actor from input). Add `src/lib/grants/store.ts` to the `allowed` list in `tests/unit/dal-boundary.test.ts`.
- [X] T050 [P] [US5] Create `src/components/owner/GrantForm.tsx` (client; email, reason select with the four reasons, optional note, Grant button) and `src/components/owner/GrantHistory.tsx` (active grants with a "Remove" button and a note field, then recent events with who, when, reason and note; the list ends at 100 with a plain note).
- [X] T051 [US5] Create `src/components/screens/OwnerAccessScreen.tsx` (`requireOwner(ownerAccessPath())`) and `src/app/(panel)/owner/access/page.tsx` (Suspense with `PageFallback`, `robots: { index: false }`); add the "Access" link to `src/components/owner/OwnerNav.tsx` after Earnings and update `tests/unit/OwnerNav.test.tsx`. Built from existing owner table, form and button patterns with tokens only (no approved design; see T062).
- [X] T052 [US5] Extend `tests/unit/owner-access.test.ts` with the grants service (every-function check) and `src/lib/grants/actions.ts` (calls `requireOwner`), and add `tests/unit/grants/AccessScreen.test.tsx` (form fields labelled, history renders who and when, unknown-email message shown, remove button present for active grants).

**Checkpoint**: the whole money flow can be tested end to end with granted test accounts, no gateway needed.

---

## Phase 8: User Story 6 - Owner posts content requests creators see (Priority: P3)

**Goal**: owners write, edit and close short requests (stage, topic, text); every creator sees the open ones on their dashboard.

**Independent Test**: post two requests, see both for two creators, close one, see only the other remain for creators while the owner still lists both.

### Tests for User Story 6

- [X] T053 [P] [US6] Create `tests/unit/requests/requests-service.test.ts` with an in-memory store: `createRequest`, `editRequest` and `closeRequest` for owners only; stage and topic must be slugs from `src/lib/content/taxonomy.ts`; text "1 to 200 characters" (empty or 201 refused with plain words, nothing saved); `listOpenRequests` returns open only, newest first, at most 20, for creators (paused or not) and owners; a learner and nobody get `ForbiddenError`; `listAllRequests` is owner-only and includes closed ones (at most 100); a creator trying to create, edit or close is refused.

### Implementation for User Story 6

- [X] T054 [US6] Create `src/lib/requests/service.ts` (`createRequestsService({ store, now })`), `src/lib/requests/store.ts` (Prisma; add to the `allowed` list in `tests/unit/dal-boundary.test.ts`), `src/lib/requests/instance.ts`, `src/lib/requests/messages.ts` and `src/lib/requests/actions.ts` (`"use server"`, `requireOwner`, zod; after each write call `updateTag("creator-requests")`).
- [X] T055 [US6] Wire the requests into the dashboard: in `src/lib/earnings/service.ts` `getDashboard` include `listOpenRequests` output (stage label, topic label, text; no author) and pass it to `RequestsList`; update `tests/unit/earnings/dashboard-service.test.ts` for newest first, at most 20, and closed requests absent.
- [X] T056 [P] [US6] Create `src/components/owner/RequestForm.tsx` (client; stage select, topic select, text with a 200-character hint, Post button) and `src/components/owner/RequestsTable.tsx` (stage, topic, text, status, Edit and Close controls; closed rows dimmed and labelled "Closed").
- [X] T057 [US6] Create `src/components/screens/OwnerRequestsScreen.tsx` and `src/app/(panel)/owner/requests/page.tsx` (`requireOwner(ownerRequestsPath())`, Suspense with `PageFallback`); add the "Requests" link to `src/components/owner/OwnerNav.tsx` after Access and update `tests/unit/OwnerNav.test.tsx`; extend `tests/unit/owner-access.test.ts` with the requests service and actions.

**Checkpoint**: all six stories work independently.

---

## Phase 9: Polish and cross-cutting

- [X] T058 [P] Create `tests/unit/earnings/brand-copy.test.ts` modelled on `tests/unit/review/brand-copy.test.ts`: all new messages (earnings, grants, requests, dashboard copy, Payment pending) are short (under 200 characters) and avoid failed, error, invalid, wrong, you must, forbidden, denied, streak, overdue, behind and lost; new screens and components have no streak, infinite scroll, load more, quiz, score or "you missed" wording and no raw colour values; estimates are always labelled "estimated"; the creator-facing copy never mentions other creators.
- [X] T059 [P] Add a privacy scan to `tests/unit/earnings/privacy.test.ts`: none of the creator dashboard, owner Earnings, Access (except the grant target the owner typed) and Requests screens renders a learner email, name or id; the dashboard service result type has no learner fields; `CountedView` queries never select `userId` for creator-facing reads (read `src/lib/earnings/store.ts`).
- [X] T060 [P] Create `tests/unit/earnings/performance.test.ts`: a heartbeat that does not cross 30 seconds issues no counting queries at all and does not call `recordCountedViewIfCrossed`; the heartbeat transaction itself issues no counting query even when it crosses; after the commit, the crossing issues at most four reads and one insert; the dashboard issues at most ten queries (the list in `research.md` §10) and the result contains no learner field.
- [X] T061 [P] Update `docs/build-specs.md` (spec 11 status: "Built, needs both migrations applied and a manual check with real data") and `README.md` (Earnings, Access and Requests pages, the creator dashboard, counted-view rules in one short paragraph, "revenue is entered by hand until a gateway is chosen").
- [X] T062 [P] Record the owner-only utility screens of this spec in `docs/design/README.md`, as constitution VI (v2.1.0) requires after building them without a separate design: create a "Built without a design (constitution VI)" list if there is none, with one line each (screen, route, spec 11): the Earnings additions (`/owner/earnings`: revenue form, adjustments, close control, payout history and Mark as paid), the Access page (`/owner/access`) and the Requests page (`/owner/requests`). Do this after those screens exist (after T044, T051 and T057). The creator dashboard is not on this list: it follows `CreatorDashboard.dc.html`.
- [X] T063 Re-read `src/lib/earnings/service.ts`, `src/lib/grants/service.ts` and `src/lib/requests/service.ts` once against FR-014, FR-025 and FR-035 (creators only ever see their own numbers; owner functions refuse everyone else) and fix anything the tests missed.
- [X] T064 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; fix every failure. Check `.next/dev/types` errors are only stale route types that `next build` regenerates.
- [ ] T065 Run the walkthrough in `quickstart.md` in a browser with a signed-in owner, two creators, learner accounts, both migrations applied (`npm run db:migrate`, then `npm run db:deploy`), including the trigger checks (try an `UPDATE` on a closed month and on a `Payout` row in SQL and confirm the database refuses), time SC-002 and SC-003 with a stopwatch, check SC-006 (the creator dashboard shows every figure within 3 seconds on a normal connection) and SC-008 (a creator who has not seen the product can explain from the dashboard alone how their earnings work, using the words estimated, final and paid consistently). This needs a person: it requires sign-in, real data and a browser.

---

## Dependencies and execution order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies; T001, T002 and T003 run in parallel.
- **Foundational (Phase 2)**: needs T001 (constitution I: `docs/product.md` is updated before any feature work) and T003; T004 → T005 → T006; T007 needs T006; T008 → T009 and T009 also needs T005 (the generated client must have `manualAccessAt`); T010 is independent. Blocks all stories.
- **US1 (Phase 3)**: needs Phase 2 (T005, T008, T003). Independent of the other stories. Order inside: T011, T012 (tests), T013, T014, then T015 (T015 needs T012 and T014).
- **US2 (Phase 4)**: needs Phase 2 (T005, T010). Reads counted views but does not need US1 code (tests seed rows).
- **US3 (Phase 5)**: needs US2's `split.ts`, `service.ts`, `store.ts` and `earnings-memory.ts` (T018 to T023) for the estimate; its other reads need only Phase 2.
- **US4 (Phase 6)**: needs US2 (service, store, screen) and US3's `EarningsCard` (T034) for T045.
- **US5 (Phase 7)**: needs Phase 2 (T008, T009) and US1's `record-view.ts` for T048; independent of US2 to US4.
- **US6 (Phase 8)**: needs Phase 2; T055 needs US3's service and `RequestsList` (T033, T034).
- **Polish (Phase 9)**: after the stories you want to ship.

### Within each story

Tests first (they fail), then pure modules, services, stores, actions, components, screens. A story's checkpoint must pass before the next priority starts if working alone.

### Parallel opportunities

- Setup: T001, T002, T003 together.
- Foundational: T007 and T010 beside T008/T009 once T006 exists.
- US1: T011 and T012 together; US2: T016, T017, T020, T021, T025 together; US3: T028, T029, T030, T031, T034 together; US4: T037, T038, T039 together, then T043 beside T041; US5: T047, T048 together, T050 beside T049; US6: T053 then T056 beside T054.
- US1, US2 and US5 can be built by different people after Phase 2.
- Polish: T058 to T062 together.

### Parallel example: User Story 2

```text
Task: "Create tests/unit/earnings/split.test.ts (T016)"
Task: "Create tests/unit/earnings/revenue-source.test.ts (T017)"
Task: "Create src/lib/earnings/split.ts (T020)"
Task: "Create src/lib/earnings/revenue-source.ts (T021)"
Task: "Create the owner components in src/components/owner/ (T025)"
```

## Implementation strategy

### MVP first (US1 + US2 + US3)

1. Phase 1 and Phase 2 (schema, triggers, access rule, shared pure rules).
2. US1: counted views recorded honestly.
3. US2: the owner enters revenue and reads the estimated statement.
4. US3: creators see their dashboard.
5. **Stop and validate** with the quickstart sections 2 to 4 using granted test accounts (US5's grant UI is not needed if rows are seeded; add US5 early if you want to test in a browser).

### Incremental delivery

1. Foundation → US1 → US2 → US3 (MVP: creators see honest estimates).
2. US4: closing and payouts (turns estimates into promises).
3. US5: manual access (also makes end-to-end testing easy; can be pulled forward right after US1).
4. US6: requests.
5. Polish and the manual walkthrough.

## Notes

- [P] tasks = different files, no dependencies.
- The [Story] label maps each task to spec.md for traceability.
- Tasks that quote a data-model constraint quote it verbatim; do not loosen them.
- Triggers live in their own migration (T006) because the first migration is applied before triggers are added, as in spec 10.
- T065 needs a person (sign-in, real data, browser), like spec 10's last task.
- Commit after each task or logical group; nothing is committed by these tasks on their own.
