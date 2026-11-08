# Implementation Plan: Honest Hours

**Branch**: `005-honest-hours` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-honest-hours/spec.md`, plus the planning inputs: track watch time on the client from the player's `timeupdate` and `playing` events plus `document.visibilityState`; batch it into heartbeats every 15 seconds to a server action that validates each heartbeat and caps it at its elapsed time; models `WatchSession` (user, video, language, seconds, day), `ManualTime` and `VideoProgress` (last position, watched); totals and rhythm computed on the server with the learner's IANA time zone; stage hour estimates added to `content/languages.json` as clearly marked placeholders; unit tests for the counting rules (pause, seek, hidden tab, cap) and for day bucketing across time zones.

## Summary

Make the Hours number true, and show it everywhere it is promised.

- **Count on the client, decide on the server.** A pure tracker (`src/lib/hours/counting.ts`) turns media events, visibility changes and a monotonic clock into counted milliseconds. It counts only media progress that matches real elapsed time while the video is playing and the tab is visible, so pauses, buffering, hidden tabs, seeks and consecutive repeats of the same second add nothing. A hook feeds it from the player and sends a heartbeat every 15 seconds of counted time, and on pause, hide, end and unmount.
- **The heartbeat is a claim, not a fact.** `recordHeartbeat` (a server action) validates it with zod, clamps `seconds` to the elapsed window the client reports, places the window on the server's own clock, drops any part already counted for that learner (so two tabs never double count), and splits it across local midnight using the learner's IANA time zone. A per-session sequence number makes retries safe.
- **Three tables, one derived total.** `WatchSession` is one row per learner, language, video and local day with a running `seconds`. `ManualTime` holds time the learner added. `VideoProgress` holds last position and the watched flag. Totals, today, the 8-week rhythm and the stage are all computed from these on the server; nothing is stored twice.
- **Stage only moves forward.** The roadmap stage starts as the onboarding stage and is advanced (and persisted) when total hours pass that stage's estimate. Removing added time lowers the total but never the stage. The same one-way rule covers the hour chime.
- **Estimates are data.** `content/languages.json` gains a `roadmap` block per language with cumulative stage hours, a `status: "placeholder"` marker and a note, validated at build. Without it the "about X more hours" line is omitted.
- **Screens.** The Roadmap and Done for today pages replace their placeholders, built from `Progress.dc.html` and `Done.dc.html`. The header Hours pill shows the real total. The Library banner and "Watched" labels read `VideoProgress`.

See [research.md](research.md) for the decisions behind this.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` and `partialPrefetching` on), Node 24

**Primary Dependencies**: None new. Existing: Prisma 7 with the `pg` adapter, `zod`, Tailwind 4 tokens, Vitest and Testing Library. The chime is a short Web Audio tone, so there is no audio asset and no library. Time zone maths uses `Intl.DateTimeFormat`, which Node and every evergreen browser ship.

**Storage**: PostgreSQL through Prisma. New models `WatchSession`, `ManualTime`, `VideoProgress` and a small `HeartbeatReceipt`; new columns on `User` (`timeZone`, `watchCountedUntil`) and `LearnerLanguage` (`remindersOn`, `soundOn`, `chimedHours`, `doneAckDay`, `doneAckSeconds`). Stage estimates live in `content/languages.json`. Browser storage is not used for hours.

**Testing**: Vitest + Testing Library (jsdom), pure modules first: the counting tracker (pause, seek, hidden tab, replay, cap, rate, long gap), heartbeat clamping and watermarking, local-day bucketing and midnight splitting across time zones (including half-hour offsets, +14, −11 and a DST change), rhythm grid, stage progress and one-way advance, Done-for-today rule, manual-time validation, `isWatched` and resume rules, roadmap schema. Components (tracker hook with the fake media helper, Hours pill, add-time form, settings toggles) are tested with stubbed server actions. Prisma is not exercised in unit tests; the database paths are checked by type-check, build and the [quickstart](quickstart.md) against a Neon development branch.

**Target Platform**: Evergreen browsers 320px and up; Vercel with Neon Postgres

**Project Type**: Web application (single Next.js app, no separate backend)

**Performance Goals**: One heartbeat per 15 seconds of counted time per playing tab; each is one transaction with indexed lookups (a row lock on the learner, an upsert, a small sum). The header total refreshes from the heartbeat response, so no polling. Roadmap and Done each need a handful of indexed queries.

**Constraints**: The counted total matches true playing-and-visible time within 2 seconds per 10 minutes (SC-001); no time counted twice or invented for a gap (FR-017); the client clock and the client time zone setting never create or erase time (heartbeats carry durations, not timestamps); `next build` and tests pass with no `.env.local`; public pages stay in the static shell (hours are read inside Suspense boundaries); every action validates input with zod and filters by the session's user id; 44px targets, contrast 4.5:1, no horizontal scroll from 320px; no streak, loss or internal level name in any string.

**Scale/Scope**: 3 changed screens (Roadmap, Done, Library) and the header pill, 1 changed watch flow (resume and tracker), about 12 new components, 9 pure modules, 4 new models, 6 server actions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | MVP screens 5 (Done for today) and 6 (hours, roadmap, rhythm) in `docs/product.md`, plus the "provisional roadmap hour estimates" item under "Still to decide", which this plan keeps as marked placeholders. Reminders being sent and payments stay out |
| II. Brand behaviours | Pass | Rhythm view only; no streak count, lost-day count or warning anywhere. Done for today ends the session after the video, never mid-video. Reminders default off and nothing is sent. Autoplay-next stays off by default, and when the goal is reached the Done screen takes precedence over it. Estimates are always worded "estimate". Only stage names appear in copy |
| III. Honest hours | Pass | Counting is a pure, tested module. Only playing and visible time counts. Per language, never pooled. The server re-checks every heartbeat (clamp, no overlap, no future) so a client bug cannot inflate the total |
| IV. Multi-language by design | Pass | Every table is keyed by language code from `content/languages.json`; stage estimates are per-language data; nothing Arabic-specific in schema or logic. Target-language text keeps its own `dir` and `lang` (video titles on the banner and cards are unchanged) |
| V. Arabic first-class | Pass (n/a) | No new Arabic text handling |
| VI. Design fidelity | Pass with notes | Roadmap from `Progress.dc.html` and Done from `Done.dc.html`, using tokens. Notes: (1) the design's "20 min" control is built as a native select styled like the button, so it is keyboard and screen-reader friendly; (2) the add-time form, the added-entries list and the empty/zero states have no frame in the design, so they follow the design system patterns and are listed for review; (3) the design's Done "Today" dot is coral and the rest teal, kept as drawn |
| VII. Stack discipline | Pass | Server actions and Server Components; client components only for the tracker, the pill, forms and toggles. Docs read: server actions (mutating data), revalidating (`refresh`, `updateTag`), caching with Cache Components, authentication with Cache Components |
| VIII. Content as files | Pass | Estimates are added to `content/languages.json` and validated in `languages.schema.ts` at build; invalid shape fails the build. Learner hours stay in the database |
| IX. Quality | Pass | Core logic has unit tests (counting, day bucketing, rhythm, stages, Done rule, validation); lint, type-check, tests and build gates apply |
| X. Privacy and security | Pass | Collected: seconds per video per day, added minutes, last position and the learner's IANA time zone. No device IDs or fine-grained timelines. Every action parses input with zod, calls `requireLearner`, and filters by the session's user id. Not an anti-cheat system: the learner can only affect their own total, and the server limits mistakes and double counting rather than fraud |

No violations. Re-check after design: still passes (see [data-model.md](data-model.md) and [contracts/](contracts/)).

## Project Structure

### Documentation (this feature)

```text
specs/005-honest-hours/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── counting-rules.md          # event -> counted time table, heartbeat wire format, server clamps
│   ├── server-actions.md
│   └── roadmap-content.md         # the `roadmap` block in content/languages.json
├── checklists/requirements.md
└── tasks.md                       # created later by /speckit-tasks
```

### Source Code (repository root)

```text
content/
└── languages.json                    # + `roadmap` block on Arabic (status "placeholder"); Spanish has none

prisma/
├── schema.prisma                     # + WatchSession, ManualTime, VideoProgress, HeartbeatReceipt; new columns
└── migrations/                       # created by `prisma migrate`

src/
├── lib/
│   ├── languages.schema.ts           # + optional `roadmap` (placeholder marker, increasing cumulative hours)
│   ├── routes.ts                     # unchanged paths; adds no new screen
│   └── hours/
│       ├── counting.ts               # PURE, client-safe: tracker state machine (events + clock -> counted ms)
│       ├── heartbeat.ts              # PURE: zod schema, clamp to elapsed window, place on server clock, watermark
│       ├── time-zone.ts              # PURE: isValidTimeZone, localDay, addDays, weekStart, splitByLocalDay
│       ├── totals.ts                 # PURE: sum, formatHours "12h 40m", minutes display, safe rounding
│       ├── stages.ts                 # PURE: stage progress, remaining estimate, one-way advance
│       ├── rhythm.ts                 # PURE: 8x7 grid, this-week strip, no streak anywhere
│       ├── done-rule.ts              # PURE: when Done for today is due, acknowledged blocks, goal change
│       ├── progress-rules.ts         # PURE: isWatched (last 10% or end), resume position, pick-up choice
│       ├── manual-time.ts            # PURE: validate minutes and date against the learner's today
│       ├── hours-store.ts            # client: tiny external store so the pill follows heartbeat responses
│       ├── store.ts                  # server-only: transactions for heartbeat, summaries, manual time
│       ├── summary.ts                # server-only: totals, today, rhythm, stage for a learner and language
│       └── actions.ts                # server actions: recordHeartbeat, addManualTime, removeManualTime,
│                                     #   saveSessionSettings, acknowledgeDone, rememberTimeZone
├── hooks/
│   └── useWatchTracker.ts            # attaches the tracker to the media element, visibility, pagehide, 15s flush
├── components/
│   ├── player/
│   │   ├── PlaybackProvider.tsx      # on `ended`: flush, then Done for today if due, else existing behaviour
│   │   ├── VideoPlayer.tsx           # + start position (resume)
│   │   └── WatchTracker.tsx          # renders nothing; runs the hook, chime and outbox retry
│   ├── shell/
│   │   ├── Header.tsx                # pill moves into its own Suspense slot
│   │   ├── HoursPill.tsx             # shows the language's total; signed-out shows nothing
│   │   ├── HoursPillSlot.tsx         # server: totals for the learner's languages
│   │   └── TimeZoneSync.tsx          # reports the device time zone when it differs from the saved one
│   ├── roadmap/
│   │   ├── HoursRing.tsx
│   │   ├── StageList.tsx
│   │   ├── AddTimeForm.tsx           # client: minutes + date, inline messages
│   │   ├── ManualTimeList.tsx        # entries labelled "Added by you", remove
│   │   ├── RhythmGrid.tsx
│   │   └── SessionSettings.tsx       # minutes select, reminders and sound switches
│   ├── done/
│   │   ├── DoneStats.tsx
│   │   └── WeekStrip.tsx
│   ├── library/
│   │   └── PickUpBanner.tsx          # real data, hidden when none
│   └── screens/
│       ├── RoadmapScreen.tsx         # real
│       ├── DoneScreen.tsx            # real
│       ├── LibraryScreen.tsx         # reads progress for signed-in learners
│       └── WatchScreen.tsx           # reads progress, today, goal, settings for the tracker
tests/
└── unit/                             # hours-counting, hours-heartbeat, hours-day-bucketing, hours-rhythm,
                                      #   hours-stages, hours-done-rule, hours-progress-rules,
                                      #   hours-manual-time, languages.roadmap, WatchTracker, HoursPill, ...
```

**Structure Decision**: One Next.js app, as in earlier specs. All counting and calendar rules sit in `src/lib/hours/` as pure functions with no imports from React, Next or Prisma, so they are tested directly (constitution III). Only `store.ts`, `summary.ts` and `actions.ts` touch the database or the session.

## Complexity Tracking

No constitution violations to justify.
