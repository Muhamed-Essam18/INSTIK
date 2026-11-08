# Implementation Plan: Honest Hours

**Branch**: `005-honest-hours` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-honest-hours/spec.md`, plus the planning inputs: track watch time on the client from the player's `timeupdate` and `playing` events plus `document.visibilityState`; batch it into heartbeats every 15 seconds to a server action that validates each heartbeat and caps it at its elapsed time; models WatchSession, ManualTime and VideoProgress; totals and rhythm computed on the server with the learner's IANA time zone; stage hour estimates added to `content/languages.json` as clearly marked placeholders; unit tests for the counting rules (pause, seek, hidden tab, cap) and day bucketing across time zones.

## Summary

Turn the placeholder Hours pill, Roadmap and Done screens into real, honest numbers without adding a new dependency.

- **Count on the client, trust on the server.** A pure "counter" module turns player events into counted seconds: only while playing and visible, never across a seek, never for the same second twice in a row. A small hook batches the counted seconds and sends a heartbeat every 15 seconds, and also when playback pauses, the tab hides, or the video ends.
- **The server caps every heartbeat.** Counted time is sent as timed intervals. The `recordHeartbeat` server action checks each interval against its own length, rejects any that overlap time already counted (per language, across all devices) or end in the future, and accepts at most 20 seconds per interval, so a forged or duplicated heartbeat cannot add more time than has really passed. This also makes two tabs or devices count each real moment once (Clarification 3).
- **Offline is honest, not lost.** Unsent intervals wait in an in-memory queue and are sent in order on reconnect; at most 5 minutes of queued time is accepted per reconnect and anything beyond is not counted.
- **One end-of-video handler.** The provider flushes the counter, awaits `endOfVideo`, and only then chooses Done for today, autoplay-next or the فاهم؟ check.
- **Everything shown is computed on the server.** Totals, today's minutes, stage, the 8-week rhythm and the "about X more hours" estimate come from pure functions fed with rows and the learner's IANA time zone. The Roadmap and Done pages are dynamic Server Components; the header pill is seeded from the server and then updated live by heartbeat results.
- **Stages only move forward.** The stage chosen in onboarding is the starting point; it advances when total hours pass that stage's estimate and never moves back, even if added time is later removed (Clarifications 4 and 5).
- **Done for today** is decided by the server when a video ends, from the day's counted minutes and the number of goal-sized blocks already acknowledged that day (Clarification 1). Never mid-video.
- **Estimates are data.** `content/languages.json` gains a clearly marked provisional `roadmap` block per available language, validated at build time.

See [research.md](research.md) for the decisions behind this.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.5 (App Router, `cacheComponents` on), Node 24

**Primary Dependencies**: Existing only: `zod`, Prisma 7 with `@prisma/adapter-pg`, Auth.js (through the existing `requireLearner`), Tailwind 4 tokens, Vitest. **No new runtime dependencies.** The soft chime is one tiny audio file in `public/` played with the browser's own `Audio`; time zones use the built-in `Intl` API, so no date library is added.

**Storage**: PostgreSQL through Prisma for learner data (3 new models, 9 new columns: 6 on `LearnerLanguage`, 3 on `User`). `content/languages.json` for stage estimates. Browser memory only for the not-yet-sent seconds; nothing about hours is kept in `localStorage`.

**Testing**: Vitest. Pure modules carry the logic and are tested directly: the counter (pause, seek, hidden tab, muted background, repeated second, cap), the heartbeat cap, day bucketing and midnight split across time zones (including half-hour and DST zones), totals and stage advance, rhythm grid, goal-block logic, estimates, and minute/date validation for added time. Components (pill, add-time form, settings, Done screen, banner, card label) are tested with stubbed server actions. The database path (row lock, upserts) is covered by the [quickstart](quickstart.md) against a Neon development branch, as in spec 4.

**Target Platform**: Evergreen browsers 320px and up; Vercel with Neon Postgres

**Project Type**: Web application (single Next.js app, no separate backend)

**Performance Goals**: One heartbeat every 15 seconds while watching: one transaction of a few indexed statements. The Roadmap loads with at most 4 queries (profile, per-day totals for 8 weeks, manual entries, videos for the Done count). The header pill adds no client-side fetch; it shows server data and updates from heartbeat responses.

**Constraints**: `next build` and the tests pass with no `.env.local`; every mutation parsed with zod and filtered by the session user's id; a heartbeat can never add more than has really elapsed; at most about 15 seconds of counted time can be lost if a tab is killed abruptly, and offline time beyond 5 minutes per reconnect is not counted (honest under-count, never over-count); no hydration mismatches (nothing time-dependent is rendered before mount); 44px targets; contrast at least 4.5:1; brand voice; no streak language anywhere.

**Scale/Scope**: 3 screens changed (Roadmap, Done, Library) plus the header pill and the player; about 14 components, 11 pure modules (counter, queue, heartbeat, days, totals, stages, rhythm, goal, manual-time, watched, start-position), 3 new models, 7 new server actions (recordHeartbeat, endOfVideo, addManualTime, removeManualTime, syncTimeZone, saveSessionSettings, plus the existing updateProfile reused).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|---|---|---|
| I. Product source of truth | Pass | MVP screens 5 (Done for today) and 6 (hours, roadmap, rhythm), plus the Library behaviours in screen 3. Built from `Progress.dc.html` and `Done.dc.html`. No payments, no reminders sending |
| II. Brand behaviours | Pass | No streaks (no counter of consecutive days exists anywhere in code or copy); every session ends with Done for today; reminders default off and nothing sends; stage names only, never internal levels; thresholds always "an estimate"; warm copy when a day is missed or hours exceed an estimate |
| III. Honest hours | Pass | Counting only while playing AND visible; pure, tested counter in `src/lib/hours/`; server checks each interval against its own length and rejects overlaps; per language, never pooled |
| IV. Multi-language by design | Pass | Every new row carries a language code; estimates come from each language's data; the pill, Roadmap, rhythm, goals and progress are per language; no Arabic-specific code |
| V. Arabic first-class | Pass (n/a) | No Arabic text is created or changed; the Roadmap and Done screens are English LTR; any target-language word keeps its own `dir`/`lang` |
| VI. Design fidelity | Pass | Roadmap and Done are built from the approved screens with tokens (ring, four stage cards, rhythm grid, settings, dark Done screen). The add-time form and its list have no separate design: built from the design system patterns, as recorded in `docs/product.md` for utility screens (noted in tasks). Motion is calm; the chime is optional and off by default |
| VII. Stack discipline | Pass | Server Components by default; client code only for the counter hook, pill, add-time form, toggles and Done check. Server actions for mutations (as in spec 4). Next docs read: mutating data (server actions), caching with Cache Components, server and client components |
| VIII. Content as files | Pass | Stage estimates are data in `content/languages.json`, validated by the existing build-time schema (extended); learner data only in the database |
| IX. Quality | Pass | Tests for the counter, cap, bucketing, rhythm, stage rules and goal blocks; lint, type-check and build gates |
| X. Privacy and security | Pass | Only counted seconds, days, manual minutes and the learner's IANA time zone are stored; every action parses input with zod and filters by the session's user id; a heartbeat can neither add more than its own elapsed interval nor overlap counted time nor target another learner; no secrets reach the client |

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
│   ├── server-actions.md
│   └── counting-rules.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source Code (repository root)

```text
content/languages.json               # + per-language `roadmap` block (provisional estimates, clearly marked)
prisma/
├── schema.prisma                    # + WatchSession, ManualTime, VideoProgress; columns in data-model.md
└── migrations/                      # new migration
public/sounds/hour-chime.wav         # one soft chime (short, quiet, licence-free)

src/
├── lib/
│   ├── languages.schema.ts          # + optional `roadmap` (provisional flag, per-stage upToHours)
│   ├── routes.ts                    # unchanged paths (roadmap, done, watch already exist)
│   └── hours/
│       ├── counter.ts               # pure: event reducer -> counted seconds (tested)
│       ├── queue.ts                 # pure: device-side queue of timed intervals, oldest first, 300-second limit (tested)
│       ├── heartbeat.ts             # pure: validate an interval (own length, no overlap, late budget) (tested)
│       ├── chime.ts                 # client: plays the one soft chime, never throws
│       ├── days.ts                  # pure: local day for an instant, split across midnight, IANA zone (tested)
│       ├── totals.ts                # pure: total seconds, h/m formatting, today's seconds (tested)
│       ├── stages.ts                # pure: advanceStage, progress in stage, "about X more hours" (tested)
│       ├── rhythm.ts                # pure: 8-week grid, this-week strip, future days (tested)
│       ├── goal.ts                  # pure: has the day's goal block been reached and not yet shown (tested)
│       ├── manual-time.ts           # pure: zod schema and date/minute limits for added time (tested)
│       ├── watched.ts               # pure: watched = last 10% or end reached (tested)
│       ├── queries.ts               # server-only: read rows, build the Roadmap and Done view models
│       ├── actions.ts               # server actions: recordHeartbeat, endOfVideo, addManualTime, removeManualTime
│       ├── settings-actions.ts      # server actions: saveSessionSettings (sound, reminders), updateProfile reuse
│       └── store.ts                 # client: tiny external store of per-language totals for the pill
├── lib/player/start-position.ts     # pure: safe `?t=` start position, ignored beyond the duration (tested)
├── hooks/
│   └── useWatchCounter.ts           # client: wires media events + visibility to the counter, sends heartbeats
├── app/(shell)/learn/[language]/
│   ├── roadmap/page.tsx             # unchanged shell; screen now real
│   └── done/page.tsx                # unchanged shell; screen now real
└── components/
    ├── shell/HoursPill.tsx          # client: reads the store, picks the language from the URL, shows 12h 40m
    ├── shell/HoursPillSlot.tsx      # server: seeds totals for the learner's languages (inside Suspense)
    ├── player/WatchCounter.tsx      # client: mounts the hook beside the player, registers the before-ending flush
    ├── player/PlaybackProvider.tsx  # changed: the single `ended` handler (await flush and endOfVideo, then Done, autoplay or check)
    ├── player/VideoPlayer.tsx       # changed: starts at a valid `?t=` position (start-position.ts)
    ├── roadmap/TimeZoneSync.tsx     # client: sends the browser's time zone when the Roadmap or Done page loads
    ├── screens/
    │   ├── RoadmapScreen.tsx        # real: ring, stages, rhythm, add time, settings
    │   ├── DoneScreen.tsx           # real: minutes, videos, total hours, this week, two actions
    │   └── LibraryScreen.tsx        # learner-aware part inside Suspense; static fallback unchanged
    ├── roadmap/
    │   ├── HoursRing.tsx  StageList.tsx  RhythmGrid.tsx
    │   ├── AddTimeDialog.tsx  AddedTimeList.tsx
    │   └── SessionSettings.tsx      # minutes, reminders toggle, sound toggle
    ├── done/WeekStrip.tsx
    └── library/PickUpBanner.tsx     # real data, hidden when there is none; VideoCard gains `watched`
tests/unit/hours/                    # one test file per pure module, plus component tests
```

**Structure Decision**: Same single-app layout as specs 1 to 4. All hour rules live in `src/lib/hours/` as pure functions with no imports from React, Next or Prisma, so they are the tested core (constitution III and IX). Database access sits in one `queries.ts` and one `actions.ts` and does nothing but load rows, call the pure functions and save the result.

## Complexity Tracking

No constitution violations to justify.
