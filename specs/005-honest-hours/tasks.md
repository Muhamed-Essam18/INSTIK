---

description: "Task list for Honest Hours"
---

# Tasks: Honest Hours

**Input**: Design documents from `/specs/005-honest-hours/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution principle III requires the counting logic to be a pure, tested module and principle IX requires tests for core logic; the plan asks for unit tests of the counting rules (pause, seek, hidden tab, cap) and day bucketing across time zones. Write each pure-module test first and see it fail. Prisma queries and server actions are checked by type-check, build and the quickstart, as in spec 4.

**Organization**: Grouped by user story. Phases follow dependency order rather than story number: US1 (counting) first because every number comes from it; US2 (header pill and Roadmap) next; US4 (rhythm) and US5 (Done for today) build on the Roadmap data; US3, US6 and US7 are independent of each other after US2. Pure rules sit in Foundational because several stories share them. Task IDs are stable labels and do not follow file order: T069 and T070 (the offline queue) sit in Phase 3, T071 (time zone sync) in Phase 4 and T072 (start position) in Phase 9; they were added after the first draft.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 Only real watching counts (P1), US2 Hours in the header and on the Roadmap (P1), US3 Add time outside Instik (P2), US4 Rhythm view, no streaks (P2), US5 Done for today (P1), US6 Session settings (P3), US7 Library uses real progress (P2)

## Path Conventions

Single Next.js app: `src/`, `tests/unit/`, `prisma/`, `content/`, `public/` at the repository root. Before writing Next.js code, read the relevant guides in `node_modules/next/dist/docs/01-app/01-getting-started/` (AGENTS.md): `07-mutating-data.md`, `05-server-and-client-components.md`, `08-caching.md`. Nothing in a render path may read `window`, `Date.now()` or randomness; time and browser reads go in effects, event handlers or server components behind Suspense. Files that touch the database or the session start with `import "server-only"`. Pure modules in `src/lib/hours/` import nothing from React, Next or Prisma. Learner-facing copy follows the brand voice: short, warm, never shaming; no streaks, no "you missed", no internal level names (use Hear it, Follow it, Understand it, Join in); hour thresholds always say "an estimate". Every server action starts with zod parsing and `requireLearner`, and filters every query by the session user's id.

---

## Phase 1: Setup

- [X] T001 Confirm the baseline is green: run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` from the repo root and note any pre-existing failure
- [X] T002 [P] Add one short, quiet, licence-free chime (under 30 KB, about 1 second; synthesised by `scripts/make-chime.mjs`, so there is no third-party licence) as `public/sounds/hour-chime.wav` and record its source and licence in a one-line comment at the top of `src/lib/hours/chime.ts` (created in T057)
- [X] T003 Precondition for the add-time form (T052) and the session settings block (T060): confirm `docs/product.md` still contains the section "Design decision: utility screens" and that `docs/design/Progress.dc.html` shows "Add time outside Instik" as a button with no form design. The form is built from the design system patterns; if the section is missing, stop and ask

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: Database shape, language data for estimates, and the pure rules several stories share

- [X] T004 Extend `prisma/schema.prisma` exactly as in `data-model.md`: add models `WatchSession` (unique `(userId, languageCode, videoSlug, day)`, `day` as `@db.Date`, `seconds` Int, index `(userId, languageCode, day)`), `ManualTime` (`minutes` Int, `day` `@db.Date`, index `(userId, languageCode, day)`) and `VideoProgress` (unique `(userId, languageCode, videoSlug)`, `positionSeconds` Int, `watched` Boolean default false, index `(userId, languageCode, updatedAt)`), all with `userId` relations that cascade on delete; add to `LearnerLanguage`: `countedUntil DateTime?`, `lateWindowStart DateTime?`, `lateSeconds Int @default(0)`, `chimedHours Int @default(0)`, `doneDay DateTime? @db.Date`, `doneBlocks Int @default(0)`; add to `User`: `timeZone String?`, `remindersOn Boolean @default(false)`, `hourSound Boolean @default(false)`; add the back-relations on `User`
- [X] T005 Create the migration with `npm run db:migrate -- --name honest_hours` against the Neon development branch, then run `npm run typecheck` so the generated client in `src/generated/prisma` matches; commit the new folder under `prisma/migrations/`
- [X] T006 [P] Extend `src/lib/languages.schema.ts` with an optional `roadmap` object: `provisional` (required literal `true` while estimates are placeholders), `note` (non-empty string), `stages` array of `{ stage, upToHours }` where `stage` is one of `HEAR_IT`, `FOLLOW_IT`, `UNDERSTAND_IT` in that order with no duplicates and `upToHours` is a positive number strictly increasing; `JOIN_IN` is rejected. Failing build with a readable message, like the existing errors
- [X] T007 [P] Write `tests/unit/hours/languages-roadmap.test.ts` first: accepts the block from `data-model.md`; rejects missing `provisional`, `JOIN_IN`, a repeated stage, stages out of order, a non-increasing `upToHours` and `upToHours` of 0 or negative; accepts a language with no `roadmap`
- [X] T008 Add the clearly marked placeholder block to the Egyptian Arabic entry in `content/languages.json`: `"roadmap": { "provisional": true, "note": "Placeholder estimates until product decides", "stages": [ { "stage": "HEAR_IT", "upToHours": 30 }, { "stage": "FOLLOW_IT", "upToHours": 100 }, { "stage": "UNDERSTAND_IT", "upToHours": 250 } ] }`; leave Spanish without one; confirm `npm run build` still validates `languages.json`
- [X] T009 [P] Write `tests/unit/hours/days.test.ts` first for `splitByLocalDay(startInstant, seconds, timeZone)` and `localDay(instant, timeZone)` in `src/lib/hours/days.ts`: one entry inside a day; a crossing of local midnight in `America/New_York`, `Africa/Cairo`, `Pacific/Auckland`, `Asia/Kolkata` (UTC+5:30) and `Asia/Kathmandu` (UTC+5:45) splits exactly at local midnight and parts sum to the total; 23:59:50 local with 20 seconds gives 10 and 10; the 23-hour and 25-hour DST days (`America/New_York` in March and November); an invalid zone name is rejected; `isValidTimeZone`
- [X] T010 Implement `src/lib/hours/days.ts` (pure, built-in `Intl.DateTimeFormat` only, no date library) so T009 passes. Export `isValidTimeZone`, `localDay`, `splitByLocalDay`, `addDays`, `mondayOf(day)` and `todayIn(timeZone, now)` returning `YYYY-MM-DD` strings
- [X] T011 [P] Write `tests/unit/hours/totals.test.ts` first for `src/lib/hours/totals.ts`: `totalSeconds(watchedSeconds, addedMinutes)`, `formatHours(seconds)` giving `12h 40m`, `0h 0m`, `45 min` for under an hour in the short form, `splitHoursMinutes`, sub-minute seconds are kept in the total and not rounded away; `todaySeconds` and `videosToday`
- [X] T012 Implement `src/lib/hours/totals.ts` so T011 passes
- [X] T013 [P] Write `tests/unit/hours/stages.test.ts` first for `src/lib/hours/stages.ts`: `advanceStage(current, totalHours, estimates)` moves forward, jumps several stages for a large total, never goes back, stays put when `estimates` is undefined and when current is `JOIN_IN`; `stageProgress(stage, totalHours, estimates)` clamps to 0 to 1 and is 0 when the learner started at a later stage than their hours; `moreHours(stage, totalHours, estimates)` returns a whole number rounded up, is `null` without an estimate, and is `null` (never negative) once past it; `stageStates(current)` returns Done, You are here, Next, Later
- [X] T014 Implement `src/lib/hours/stages.ts` so T013 passes. Reuse `STAGES` and `STAGE_NAMES` from `src/lib/learner/profile-rules.ts`; never expose internal level names
- [X] T015 [P] Write `tests/unit/hours/watched.test.ts` first for `isWatched(position, duration, alreadyWatched)` in `src/lib/hours/watched.ts`: true at or beyond 90% of the duration and at the end; false below; unknown or zero duration is never watched; once true stays true; position is clamped to the duration
- [X] T016 Implement `src/lib/hours/watched.ts` so T015 passes
- [X] T017 Create `src/lib/hours/queries.ts` (starts with `import "server-only"`): `getLanguageHours(userId, languageCode, timeZone)` returning watched seconds, added minutes, today's seconds, videos today and total; `getHoursByLanguage(userId)` returning the total seconds for every language the learner has (one grouped query for the pill); both use the pure helpers from T010 and T012 and filter by `userId`. No pages call Prisma for hours directly
- [X] T018 Add `src/lib/hours/store.ts`: a tiny client external store (module-level map of language code to total seconds with `subscribe`, `getSnapshot`, `getServerSnapshot`, `seed(totals)`, `set(languageCode, totalSeconds)`) usable with `useSyncExternalStore`; no dependency; test it in `tests/unit/hours/store.test.ts` (seeding does not lower a newer value, subscribers are notified, server snapshot is stable)

**Checkpoint**: The schema is migrated, estimates validate, and the pure day, total, stage and watched rules pass their tests.

---

## Phase 3: User Story 1 - Only real watching counts (Priority: P1) MVP

**Goal**: Time is counted only while a video is playing and the tab is visible, and the server never accepts more than real elapsed time.

**Independent Test**: Play 60s visible, pause 60s, hide the tab for 30s mid-play, seek around, replay the same second: the stored total grows by about 60 seconds only, and two tabs together never exceed real time.

- [X] T019 [P] [US1] Write `tests/unit/hours/counter.test.ts` first, one test per row of `contracts/counting-rules.md` (counter section): steady play 60s credits 60s ±1; pause then play; hidden span adds nothing and the baseline resets when visible; a seek forward of 5 minutes adds nothing; seek back to the just-credited second and replay adds nothing for that second; looping a longer span credits real time; 0.75 speed for 60s of wall time credits about 60s; a 10-minute frozen-tab gap credits at most 5s; out-of-order or negative time credits nothing; `waiting` and `ended` stop counting; a simulated 10-minute session (steady `timeupdate` events at 4 per second at rate 1, with one pause and one 30-second hidden span inside) credits the true playing-and-visible time within 2 seconds (SC-001)
- [X] T020 [US1] Implement `src/lib/hours/counter.ts` (pure reducer, no timers, no DOM): state `{ playing, visible, rate, lastPosition, lastWall, lastCreditedSecond, pendingSeconds }`, events `playing`, `pause`, `waiting`, `ended`, `timeupdate(position, wallMs)`, `seeking`, `visibility`, `ratechange`, and `takePending()`; credit `min(elapsed wall, position movement / rate)` only when playing and visible and the movement is within `rate * elapsed + 0.75s`; the rules from `research.md` section 1 and 2, so T019 passes
- [X] T021 [P] [US1] Write `tests/unit/hours/heartbeat.test.ts` first for `acceptInterval({ seconds, spanSeconds, endedAgoSeconds, now, countedUntil, lateWindowStart, lateSeconds })` in `src/lib/hours/heartbeat.ts`, one test per case in `contracts/counting-rules.md` (cap and offline-queue sections): an honest live 15s interval accepted in full; a claim larger than its span cut to the span; a span over 20 rejected; an interval starting before `countedUntil` (second device, replayed queue) rejected and changing nothing; many 20s intervals ending "now" cannot exceed real time; an interval ending in the future rejected; out-of-order rejected without breaking the next valid one; first-ever interval accepted; negative or non-finite values rejected; a 5-minute offline session accepted in order (300 late seconds); a 20-minute session counts only the first 300 late seconds; a second reconnect in the same 10-minute window adds nothing past 300; a new window resets the budget; an interval older than 24 hours rejected
- [X] T022 [US1] Implement `src/lib/hours/heartbeat.ts` (pure) so T021 passes, following the numbered rules in `contracts/counting-rules.md`: `end = now - endedAgoSeconds`, `start = end - spanSeconds`; reject on invalid values, future end, span over 20, age over 24h or `start < countedUntil - 2s`; `accepted = max(0, min(seconds, spanSeconds, 20))`; late intervals (ended more than 30s ago) share a budget of 300 counted seconds per 10-minute window; return accepted seconds, the new `countedUntil` and the new late-window state
- [X] T069 [P] [US1] Write `tests/unit/hours/queue.test.ts` first for the device-side queue in `src/lib/hours/queue.ts`: intervals are kept oldest first, each with its counted seconds, span and end time; a failed send keeps the interval and the order; a successful send removes it; the queue holds at most 300 counted seconds and drops the excess (the newest); a duplicate send of the same interval is not queued twice; the queue never persists beyond memory
- [X] T070 [US1] Implement `src/lib/hours/queue.ts` (pure, no timers) so T069 passes: `enqueue`, `peek`, `ack`, `fail`, `toPayload(interval, nowMs)` which turns an interval into `spanSeconds` and `endedAgoSeconds` relative to the send time so the device clock never matters
- [X] T023 [US1] Create the heartbeat and end-of-video actions in `src/lib/hours/actions.ts` (`"use server"`, `import "server-only"`): `recordHeartbeat` and `endOfVideo` exactly as in `contracts/server-actions.md`. zod schema: `languageCode` string, `videoSlug` string, `seconds` number 0 to 20, `spanSeconds` number 0 to 20, `endedAgoSeconds` number 0 to 86400, `position` and `duration` non-negative, `timeZone` string validated with `isValidTimeZone`. Inside one Prisma interactive transaction: lock the `LearnerLanguage` row for the session user (`SELECT ... FOR UPDATE` through `$queryRaw`), call `acceptInterval` with `countedUntil` and the late-window columns, store the new `countedUntil`, `lateWindowStart` and `lateSeconds`, return `{ ok: false, code: "rejected" }` without changing anything when the interval is rejected, split the accepted interval with `splitByLocalDay` (placed at the server-computed start), upsert-increment the `WatchSession` rows, upsert `VideoProgress` (position clamped to the duration, `watched` from `isWatched`), store `User.timeZone` when changed, advance `LearnerLanguage.stage` with `advanceStage` when total hours pass the estimate, compute `chime` (a whole hour newly crossed, `User.hourSound` true, then raise `chimedHours`), and return `{ ok, accepted, totalSeconds, todaySeconds, stage, chime }`. Verify the language is one of the learner's profiles and the video slug exists for it (use `getVideo` from `src/lib/content`)
- [X] T024 [US1] Implement `endOfVideo` in the same file: only acts when the recorded `positionSeconds` is within the last 10% of the video; reads today's seconds and the goal (`minutesPerDay * 60`); applies `shouldShowDone` from `src/lib/hours/goal.ts` (created in T042); on true, sets `doneDay` to today and `doneBlocks = floor(todaySeconds / goal)`; returns `{ ok: true, showDone }`. Until T042 exists, write only the action's signature and the "within the last 10%" check here; T043 finishes it
- [X] T025 [US1] Create `src/hooks/useWatchCounter.ts` (client): takes the media element from `usePlayback`, feeds `playing`, `pause`, `waiting`, `ended`, `timeupdate`, `seeking`, `seeked`, `ratechange` and `document.visibilitychange` into the counter from T020 using `performance.now()` only inside event handlers; turns pending seconds into timed intervals in the queue from T070; every 15 seconds while there are pending seconds, and immediately on pause, tab hidden, ended and `pagehide`, sends the queued intervals oldest first, one `recordHeartbeat` call each, with `seconds`, `spanSeconds`, `endedAgoSeconds` and the learner's IANA zone from `Intl.DateTimeFormat().resolvedOptions().timeZone`; a failed send (offline) keeps the interval and its order and tries again on the next beat and on the browser's `online` event; a `rejected` answer drops that interval; the queue keeps at most 300 counted seconds; on success writes `totalSeconds` into the store from T018; never blocks playback; cleans up listeners and timers on unmount
- [X] T026 [US1] Create `src/components/player/WatchCounter.tsx` (client, renders nothing visible) that mounts the hook for the current `languageCode` and `videoSlug` and is placed beside the player in `src/components/screens/WatchScreen.tsx` only for a signed-in learner with a profile; check that signed-out visitors cannot reach the watch route (spec 4) so no counting runs without an account
- [X] T027 [US1] Component test `tests/unit/hours/WatchCounter.test.tsx`: with a stubbed `recordHeartbeat` and a fake media element, playing for 30 fake seconds sends intervals of about 30 seconds in total in two sends, pausing sends the remainder, hiding the tab stops further sends, a failed send is retried in order with the kept intervals (including after an `online` event), a `rejected` answer drops only that interval, and 20 offline minutes queue no more than 300 counted seconds

**Checkpoint**: Watching adds honest time to the database; nothing is shown yet except through the quickstart's database check.

---

## Phase 4: User Story 2 - Hours in the header and on the Roadmap (Priority: P1)

**Goal**: The pill shows real hours and the Roadmap page matches `Progress.dc.html` for the ring, heading and stages.

**Independent Test**: With a learner at 12h 40m, the pill and the ring show the same total, the stage cards show Done / You are here / Next / Later, and the estimate line says "an estimate".

- [X] T028 [US2] Rewrite `src/components/shell/HoursPill.tsx` as a client component using `useSyncExternalStore` with the store from T018 and the language from the URL (`languageSlugFromPathname`, falling back to the default slug passed in); show `formatHours`, a ring in the 28px icon, and the `aria-label` "Hours: 12 hours 40 minutes" (no longer "Hours are not tracked yet"); show a neutral dash only when no learner totals were seeded (signed-out)
- [X] T029 [US2] Create `src/components/shell/HoursPillSlot.tsx` (server): loads the learner with `getLearner()` and `getHoursByLanguage`, passes the totals to `HoursPill`; render it in `src/components/shell/Header.tsx` inside `<Suspense>` with a same-size fallback so the header does not shift and the public shell stays static
- [X] T030 [P] [US2] Component test `tests/unit/hours/HoursPill.test.tsx`: shows `0h 0m` for a seeded zero, shows the total for the language in the URL, updates when the store changes, shows the neutral state with no seed, and has the new accessible name
- [X] T031 [US2] Add `getRoadmapView(userId, language)` to `src/lib/hours/queries.ts` returning total, watched and added seconds, stage, stage states, progress through the stage, `moreHours`, next-stage name, and the added entries list (id, day, minutes) newest first; uses `stages.ts` with the language's `roadmap` data
- [X] T032 [P] [US2] Create `src/components/roadmap/HoursRing.tsx`: the 180px ring from the design (`r=76`, coral on `coral-tint`), centre text `12h 40m` and "Hours", `role="img"` with the label "Progress through the Follow it stage" using the real stage name; stroke dash from `stageProgress`; tokens only, no hard-coded colours
- [X] T033 [P] [US2] Create `src/components/roadmap/StageList.tsx`: the four-column ordered list (stacking to one column on narrow screens) with Done (teal), You are here (ink border, coral bar, "About N more hours to <next stage> (an estimate)"), Next, Later; hides the "more hours" line when `moreHours` is null and shows warm copy ("You're past the estimate. Keep going at your own pace.") when past it; descriptions from the design; stage names only
- [X] T034 [US2] Replace the placeholder in `src/components/screens/RoadmapScreen.tsx` with the real screen: `requireProfile` for the language, the hero card (ring, heading "N hours of Egyptian Arabic so far. Nice." built from the language name and variety, the supporting line, the honest-counting note, the "Add time outside Instik" button area), then the stage list; leave the rhythm and settings sections as slots for T040 and T056, and mount `TimeZoneSync` (T071). The heading copy for zero hours is warm ("Your first hour is waiting.")
- [X] T071 [US2] Add the `syncTimeZone({ timeZone })` action to `src/lib/hours/actions.ts` (zod string, `isValidTimeZone`, updates only the session user's `User.timeZone` when it differs) and a client component `src/components/roadmap/TimeZoneSync.tsx` that renders nothing, reads `Intl.DateTimeFormat().resolvedOptions().timeZone` in an effect when the Roadmap or Done page loads, calls the action, and calls `router.refresh()` once only when the stored zone actually changed. Server code falls back to UTC only while the zone is unknown. Test in `tests/unit/hours/TimeZoneSync.test.tsx`: sends the zone once, refreshes only on change, does nothing visible, and ignores an invalid result
- [X] T035 [P] [US2] Component tests `tests/unit/hours/RoadmapScreen.test.tsx`: states for each stage, bar width, the estimate wording includes "estimate", no number when the language has no estimate or the learner is past it, no internal level names in the output

**Checkpoint**: Hours are visible in the header and on the Roadmap; US1 and US2 together deliver the core promise.

---

## Phase 5: User Story 4 - Rhythm view with no streaks (Priority: P2)

**Goal**: The last 8 weeks of days watched in the learner's time zone, with nothing to lose.

**Independent Test**: Watch on two days and add time on a third; exactly those three days are marked, around local midnight too.

- [X] T036 [P] [US4] Write `tests/unit/hours/rhythm.test.ts` first for `buildRhythm({ today, watchedByDay, addedDays })` and `weekStrip(today, ...)` in `src/lib/hours/rhythm.ts`: always 8 columns of 7 days, Monday first, ending with the current week; 59 counted seconds is a rest day, 60 is watched, any added time is watched; days after today are flagged `future`; a learner whose today differs from UTC's today; the week strip returns Mon to Sun with today marked; no field anywhere counts consecutive days
- [X] T037 [US4] Implement `src/lib/hours/rhythm.ts` (pure, using `mondayOf` and `addDays` from `days.ts`) so T036 passes
- [X] T038 [US4] Add `getRhythm(userId, language, timeZone)` to `src/lib/hours/queries.ts`: one grouped query for the last 8 weeks of `WatchSession` seconds per day and one for `ManualTime` days, then `buildRhythm`
- [X] T039 [P] [US4] Create `src/components/roadmap/RhythmGrid.tsx`: the section "Your rhythm" with the 8-column grid of 7 rows, `role="img"` and label "Calendar of days watched" plus a visually available text list for screen readers ("Watched on 14 of the last 56 days"), legend Watched / Rest day, and the line "No streaks. A rest day never costs you anything."; future days drawn faint and never as missed; tokens for colours
- [X] T040 [US4] Mount the grid in `RoadmapScreen.tsx` (the slot left in T034) with data from `getRhythm`; component test `tests/unit/hours/RhythmGrid.test.tsx` checks legend text, 56 cells, future cells, and that the words "streak" (other than in the "No streaks" line), "missed" and "lost" appear nowhere in the rendered screen

**Checkpoint**: The Roadmap now matches the design except add-time and settings.

---

## Phase 6: User Story 5 - Done for today (Priority: P1)

**Goal**: After the video that reaches the daily goal ends, show the Done screen with real numbers; never mid-video.

**Independent Test**: Set minutes per day to 10, watch past 10 minutes inside a longer video, let it end: the Done screen appears with correct figures; "I have a bit more time" delays it until another goal-sized block.

- [X] T041 [P] [US5] Write `tests/unit/hours/goal.test.ts` first for `shouldShowDone(todaySeconds, goalSeconds, doneBlocks)` in `src/lib/hours/goal.ts`: true exactly when `todaySeconds >= goalSeconds * (doneBlocks + 1)`; false below the goal; false for a goal of 0; `blocksReached(todaySeconds, goalSeconds)`; `doneBlocks` is treated as 0 for a different local day (`effectiveDoneBlocks(doneDay, today, doneBlocks)`)
- [X] T042 [US5] Implement `src/lib/hours/goal.ts` (pure) so T041 passes
- [X] T043 [US5] Finish `endOfVideo` in `src/lib/hours/actions.ts` (see T024) using `goal.ts`; add a unit-level check through a small pure helper `decideDone({ position, duration, todaySeconds, goalSeconds, doneDay, doneBlocks, today })` in `goal.ts` tested in `goal.test.ts` (not within the last 10% returns false; reached returns the new `doneBlocks`)
- [X] T044 [US5] Make `src/components/player/PlaybackProvider.tsx` the only `ended` handler. `WatchCounter.tsx` registers an async "before ending" function with the provider (flush the queued intervals, then await `endOfVideo`) instead of listening to `ended` itself. The provider's single handler awaits it first, then chooses in this order: when `showDone` is true, `router.push(donePath(languageSlug))` (this wins over autoplay-next and the check); else autoplay-next if on; else the فاهم؟ check scroll and focus as today. If the flush or `endOfVideo` fails, fall back to the existing behaviour. Nothing runs before `ended`
- [X] T045 [US5] Add `getDoneView(userId, language)` to `src/lib/hours/queries.ts`: today's seconds rounded to whole minutes, videos today, total formatted hours, the week strip, language display name
- [X] T046 [P] [US5] Create `src/components/done/WeekStrip.tsx`: the "This week" list of seven days Mon to Sun (teal watched, coral today, plain outline rest, dashed future), `aria-label="Days you watched this week"`, with a visible text alternative for each day state, and the line "Missed a day? That's fine. Nothing is lost."
- [X] T047 [US5] Replace the placeholder in `src/components/screens/DoneScreen.tsx` with the design from `docs/design/Done.dc.html`: dark ink background, check ring, "That's enough for today." and "See you tomorrow.", three cards (minutes watched today, videos, total hours of the language), the week strip, the "See your roadmap" button (links to the Roadmap) and the quiet "I have a bit more time" link (to the Library). A signed-in learner who opens the route directly still sees it with their real numbers; singular and plural wording ("1 video", "1 min")
- [X] T048 [P] [US5] Component tests `tests/unit/hours/DoneScreen.test.tsx` (figures, both actions with correct hrefs, no shaming words) and `tests/unit/hours/endOfVideo.test.tsx` (with stubbed actions: nothing is shown or navigated before `ended`, `showDone: true` navigates to Done even with Autoplay next on, `showDone: false` keeps the existing end-of-video behaviour; an order test with fake promises proves the single handler awaits the flush and then `endOfVideo` before it navigates, starts autoplay or focuses the check, and that nothing starts early or twice; a failing `endOfVideo` falls back to the existing behaviour)

**Checkpoint**: Sessions end with Done for today, never mid-video.

---

## Phase 7: User Story 3 - Add time outside Instik (Priority: P2)

**Goal**: Learners add minutes and a date, clearly labelled "Added by you", and can remove their own entries.

**Independent Test**: Add 45 minutes for yesterday: the total grows by 45 minutes, the entry is labelled, yesterday appears in the rhythm; removing it lowers the total but the stage stays.

- [X] T049 [P] [US3] Write `tests/unit/hours/manual-time.test.ts` first for `validateManualTime({ minutes, day, today })` and its zod schema in `src/lib/hours/manual-time.ts`: accepts whole minutes from 1 to 600; rejects 0, negative, fractional, above 600 and non-numeric; rejects a date after today in the learner's zone and a date more than 365 days before it; handles the case where it is already tomorrow in UTC; `canAddMore(countForDay)` allows at most 20 entries per day and language
- [X] T050 [US3] Implement `src/lib/hours/manual-time.ts` (pure) so T049 passes; messages are short, kind and specific ("Enter a whole number of minutes, from 1 to 600.")
- [X] T051 [US3] Add `addManualTime` and `removeManualTime` to `src/lib/hours/actions.ts` per `contracts/server-actions.md`: parse with the T050 schema, validate and store the learner's `timeZone`, enforce the 20-per-day limit, create or delete the `ManualTime` row (delete only where `userId` matches), advance the stage with `advanceStage` on add and never change the stage on removal, never touch `chimedHours`, return the new `totalSeconds` and `stage`
- [X] T052 [US3] Create `src/components/roadmap/AddTimeDialog.tsx` (client): the "Add time outside Instik" button from the design opening an accessible dialog (native `<dialog>` or the project's existing pattern, focus trapped and returned, Escape closes) with a labelled minutes field and a date field defaulting to today in the learner's zone, inline error text next to the field, a pending state, and a note "It will show as added by you." On success it closes, updates the store and the page data. Built from the design system (see T003)
- [X] T053 [US3] Create `src/components/roadmap/AddedTimeList.tsx`: lists entries newest first with date, minutes and the label "Added by you", a "Remove" button per entry with an accessible name that includes the date and minutes, and shows nothing when there are none; show the watched versus added split in the hero card note ("9h 55m watched · 2h 45m added by you") from `getRoadmapView`
- [X] T054 [P] [US3] Component tests `tests/unit/hours/AddTime.test.tsx` with stubbed actions: valid add updates the total and list, each invalid case shows its message and calls no action, remove updates the list, labels are present, keyboard and focus behave in the dialog; after a stubbed `removeManualTime` result the stage shown stays the same (the stage never moves back, FR-009b) and no chime is played; and a server-side test of the removal rules in `tests/unit/hours/remove-rules.test.ts` on the pure helper used by `removeManualTime` (stage unchanged, `chimedHours` unchanged, total lowered). Accessibility checks in the same file: the dialog has an accessible name and traps focus, fields have labels, errors are linked with `aria-describedby`, buttons are at least 44px high, and remove buttons name the date and minutes

**Checkpoint**: The Roadmap shows honest, labelled outside time.

---

## Phase 8: User Story 6 - Session settings (Priority: P3)

**Goal**: Minutes per day, reminders (off by default, never sent) and an optional soft sound.

**Independent Test**: Change minutes to 30, turn sound on, reload: both persist; reminders default off; the chime plays once when an hour is crossed with sound on.

- [X] T055 [US6] Create `src/lib/hours/settings-actions.ts` (`"use server"`): `saveSessionSettings({ remindersOn?, hourSound? })` with a zod schema of optional booleans (reject anything else), updating only the session user's `User` row; nothing in this file sends or schedules anything
- [X] T056 [US6] Create `src/components/roadmap/SessionSettings.tsx` (client) from the "Your sessions" card: a labelled minutes choice (10, 20, 30, 60 using the existing `updateProfile` action and `MINUTES` from `profile-rules.ts`, shown as "20 min"), a Reminders switch ("Rare and friendly. Off by default.") and a "Sound when an hour is added" switch ("One soft chime"), each `aria-pressed` with a visible focus, at least 44px high, optimistic with a quiet note and rollback on failure; mount it in `RoadmapScreen.tsx` beside the rhythm
- [X] T057 [US6] Create `src/lib/hours/chime.ts` (client): `playChime()` using `new Audio("/sounds/hour-chime.wav")` at low volume, created lazily on first use, catching a refused play silently; include the source and licence comment from T002; in `useWatchCounter.ts` call it once when a heartbeat result has `chime: true`
- [X] T058 [P] [US6] Component tests `tests/unit/hours/SessionSettings.test.tsx`: defaults (reminders off), toggles announce state, minutes change calls `updateProfile`, a failed save rolls back with a note; a test for `useWatchCounter` or `chime.ts` that a `chime: true` result plays once and `false` never plays

**Checkpoint**: The Roadmap page is complete.

---

## Phase 9: User Story 7 - Library uses real progress (Priority: P2)

**Goal**: The banner and the Watched labels come from real data.

**Independent Test**: Watch half of a video: it is the banner. Reach the last 10% of another: its card says Watched. Signed out: neither appears.

- [X] T059 [US7] Add `getLibraryProgress(userId, languageCode)` to `src/lib/hours/queries.ts` returning `{ pickUp: { videoSlug, positionSeconds } | null, watchedSlugs: string[] }`; pick-up is the newest `VideoProgress` with `watched = false` and `positionSeconds > 0` whose video still exists in the content
- [X] T060 [US7] Update `src/components/library/PickUpBanner.tsx` to take `pickUp` as a prop instead of the `PICK_UP` constant, render nothing when it is null, and link to the watch page with a start position that the player honours: `?t=<seconds>` is read in `src/components/player/VideoPlayer.tsx` through the pure helper `startPosition(param, duration)` in `src/lib/player/start-position.ts`, which returns 0 for a missing, negative, fractional-garbage or non-numeric value and for any position at or beyond the duration, and otherwise the whole second
- [X] T061 [US7] Update `src/components/library/VideoCard.tsx` and `src/components/library/LibraryBrowser.tsx` to accept `watchedSlugs` and show a "Watched" label (text, not colour alone) on watched cards only
- [X] T062 [US7] Update `src/components/screens/LibraryScreen.tsx`: split the learner-dependent part into an async server component inside `<Suspense>` whose fallback is the current static list without banner or labels, so the public Library stays static and nothing shifts; signed-out visitors and learners without a profile in that language get the static version
- [X] T063 [P] [US7] Component tests `tests/unit/hours/LibraryProgress.test.tsx`: banner appears with the right title, time and host, is hidden when null, labels appear only on watched cards, a second language's progress is not used, signed-out render has neither
- [X] T072 [P] [US7] Write `tests/unit/hours/start-position.test.ts` first for `startPosition(param, duration)`: `"134"` with duration 600 gives 134; a position beyond the duration, equal to it, negative, `"abc"`, empty, `NaN` and `Infinity` all give 0; a fractional value is floored; and a component test that `VideoPlayer` seeks only to a valid start and plays from 0 otherwise. Implement `src/lib/player/start-position.ts` to pass it (this task precedes T060's use of the helper)

**Checkpoint**: All seven stories work independently.

---

## Phase 10: Polish and cross-cutting

- [X] T064 [P] Brand sweep: grep `src/` and the changed screens for forbidden terms (`streak` outside the single "No streaks" line, `missed`, `lost`, `overdue`, `Superbeginner`, `Beginner`, `Intermediate`, `Advanced`) and for a stage estimate shown without the word "estimate"; add the check as `tests/unit/hours/brand-copy.test.ts` over the Roadmap, Done and settings component output
- [X] T065 [P] Accessibility pass on Roadmap, Done, add-time dialog and toggles: every control labelled, 44px targets, visible focus, contrast at least 4.5:1 with tokens (coral only as a fill, `coral-text` for coral text), the ring and rhythm have text alternatives, motion calm, no horizontal scroll from 320px. Per-component checks also live in the Roadmap component tests (T035, T040, T058): labelled controls, `aria-pressed` on toggles, 44px minimum size classes, text alternatives for the ring and the rhythm grid, and the add-time dialog checks in T054; this task is the manual review that confirms them
- [X] T066 [P] Performance and safety pass: confirm a heartbeat is one transaction of a few indexed statements, the Roadmap makes no more than 4 queries, the public pages remain in the static shell (`npm run build` output), no secrets or database modules reach client bundles
- [X] T067 Update `docs/product.md` only if the placeholder estimates need a mention under "Still to decide" (they already do: "provisional roadmap hour estimates"); otherwise leave it unchanged, and add a one-line note in `specs/005-honest-hours/quickstart.md` if the migration name differs
- [X] T068 Run the full [quickstart](quickstart.md) against the Neon development branch, then `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; record results and any follow-ups at the end of this file

---

## Dependencies and execution order

- **Phase 1** has no dependencies. **Phase 2** needs Phase 1 and blocks everything else.
- **US1 (Phase 3)** needs Phase 2. Its `endOfVideo` part (T024) waits for the goal rule in Phase 6 (T042/T043).
- **US2 (Phase 4)** needs Phase 2 and US1's store writes for live updates, but the screens can be built in parallel with US1 using seeded data.
- **US4 (Phase 5)** needs Phase 2 and the Roadmap shell from US2 (T034).
- **US5 (Phase 6)** needs US1 (heartbeats and `endOfVideo`) and Phase 2.
- **US3 (Phase 7)** needs Phase 2 and the Roadmap shell (T034). **US6 (Phase 8)** needs US2's Roadmap shell and US1's hook for the chime. **US7 (Phase 9)** needs US1's `VideoProgress` writes.
- **Phase 10** after all stories you intend to ship.

## Parallel opportunities

- Phase 2: T006/T007, T009, T011, T013, T015 are different files and can be written together.
- US1: T019 and T021 (tests) in parallel; US2: T030, T032, T033, T035; US4: T036 and T039; US5: T041, T046, T048; US3: T049 and T054; US6: T058; US7: T063.
- After US2, US3, US4, US6 and US7 can be done by different people at once.

## Implementation strategy

1. **MVP (honest counting)**: Phases 1 to 3, then Phase 4. At that point the promise is real: hours are counted honestly and visible in the header and on the Roadmap.
2. **Ends sessions properly**: Phase 6 (Done for today) and Phase 5 (rhythm) complete the Roadmap and the brand's "sessions end" rule.
3. **Then** Phase 7 (outside time), Phase 9 (Library) and Phase 8 (settings and chime), in any order.
4. Finish with Phase 10 and the quickstart. Stop and validate at every checkpoint.

## Notes

- Estimates in `content/languages.json` are placeholders (`provisional: true`); replacing them is a data change only.
- A heartbeat can lose at most about 15 seconds if the tab is killed abruptly; this is an honest under-count by design.
- Stage never moves back and the chime never replays, even after removing added time (spec FR-009a and FR-009b).

## Implementation results (2026-11-08)

- `npm run lint`, `npm run typecheck`, `npm test` (82 files, 787 tests) and `npm run build` all pass.
- Live check against the Neon development branch (a throwaway learner, removed afterwards): honest interval accepted and placed on the learner's local day; overlapping interval (second tab) and a replayed offline queue rejected; offline queue accepted in order; interval split at local midnight in Pacific/Auckland; stage advanced past the estimate and not moved back after removing added time; bad added time and another learner's entry rejected; Done for today decided only at the end of a watched video, once per goal block; Roadmap view built from 4 queries; time zone and settings stored.
- Browser check of the Roadmap, add-time dialog and Done screen against the design, with a seeded session.
- Deviations and notes: the chime is `public/sounds/hour-chime.wav` (synthesised by `scripts/make-chime.mjs`), not an mp3; interval overlap tolerance is 2 seconds, not 1; added time counts toward total hours and the rhythm but not toward today's goal or "watched today"; the stage can still be changed by hand in Settings (spec 4).
