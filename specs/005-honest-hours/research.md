# Research: Honest Hours

Decisions behind [plan.md](plan.md). No `NEEDS CLARIFICATION` remains.

## 1. What counts as one counted second (client)

**Decision**: The counter is a pure reducer over events: `play/playing`, `pause/waiting/ended`, `timeupdate(position, now)`, `seeking/seeked`, `visibility(visible|hidden)`, `ratechange`. A span between two consecutive `timeupdate` samples is credited only when all hold: the video is playing, the tab is visible, the media position moved forward, and the movement is consistent with real playback (the position advanced by no more than the elapsed wall time times the playback rate, plus 0.75s of slack). The credit is the smaller of the elapsed wall time and the position movement divided by the rate. Any other span (a jump, a pause, a hidden tab, a stall) is dropped and the sample becomes the new baseline.

**Rationale**: Event-driven sampling is what the planning input asked for and is cheap. Capping the credit by both wall time and position movement means neither a stalled player nor a scripted position change can add time. At 0.75x, ten minutes of real watching counts as ten minutes, which is what "hours spent" means.

**Alternatives considered**: a one-second `setInterval` while playing (extra timer, drifts in background tabs, no better for honesty); counting media-position seconds only (under-counts slow speed, over-counts nothing but ignores real time); polling `visibilityState` (the `visibilitychange` event is exact).

## 2. Replaying the same second

**Decision**: The counter remembers the last credited whole media second. A sample whose whole second equals it adds nothing. A seek resets the baseline but keeps this memory, so seeking back to the second just credited and playing it again adds nothing for that second.

**Rationale**: Matches the spec literally ("the same second twice in a row") and defeats the cheapest abuse, a one-second loop. Looping a longer span is real listening and is allowed to count.

**Alternatives considered**: a set of every credited second (would stop genuine re-watching of a hard sentence from counting, which is the opposite of the product's idea).

## 3. Muted background tabs

**Decision**: A hidden tab never counts, muted or not. A visible but muted video counts (the learner may be reading the transcript).

**Rationale**: The spec forbids muted background tabs; hidden already covers it exactly and needs no audio detection. Picture-in-picture or a visible second window count as visible, which is honest.

**Alternatives considered**: requiring unmuted audio (blocks silent reading practice and cannot be proven anyway).

## 4. Heartbeats: cadence, content, and what the server trusts

**Decision**: Counted time is cut into timed intervals of at most 20 seconds. Every 15 seconds while there is uncounted time, and immediately on pause, tab hidden, ended and navigation away, the hook sends `{ languageCode, videoSlug, seconds, spanSeconds, endedAgoSeconds, position, duration, timeZone }` to the server action `recordHeartbeat`: `seconds` counted inside an interval that lasted `spanSeconds` and ended `endedAgoSeconds` ago. Times are relative so the device clock never matters; the server turns them into `[start, end]` using its own clock. The server loads the learner's language row with a row lock and accepts an interval only if: it ends no later than now (plus 2s of jitter), it starts no earlier than `countedUntil` (2s tolerance for network jitter), and it is not older than 24 hours. It then accepts `min(seconds, spanSeconds, 20)` and sets `countedUntil` to the interval's end. An interval that overlaps counted time, or arrives out of order, is rejected whole.

If the device was offline, unsent intervals wait in an in-memory queue (oldest first) and are sent in order on reconnect. The device keeps at most 300 counted seconds in the queue and drops the rest. The server enforces the same limit: an interval that ended more than 30 seconds ago is "late", and late intervals together add at most 300 counted seconds in any 10-minute window (`lateWindowStart`, `lateSeconds`); the excess is not counted.

**Rationale**: Capping each interval against its own length, plus the no-overlap rule, means real time is the ceiling: a forged claim cannot start before the last counted moment or end in the future, so two tabs or devices can never add more than real time together (Clarification 3). The queue keeps honest offline watching (up to 5 minutes per reconnect) instead of silently losing it, while the late-budget stops a long offline session or a replayed queue from being used to inflate hours.

**Alternatives considered**: per-video last-heartbeat (two videos at once could double count); a signed token per heartbeat (more moving parts for the same guarantee); Route Handler plus `navigator.sendBeacon` for the final beat (would allow saving on tab close, but the planning input asks for a server action and the loss is at most 15 seconds of under-count, never an over-count). Pause, hide and end flush in time because the tab is still alive then; a persistent queue in `localStorage` (would survive a closed tab, but adds device-stored hour data that could be edited) was rejected for the same reason.

## 5. Where "day" comes from

**Decision**: The learner's IANA time zone is read by the client with `Intl.DateTimeFormat().resolvedOptions().timeZone`, sent with heartbeats, with added time and whenever the Roadmap or Done page loads (UTC only while unknown), validated on the server by constructing an `Intl.DateTimeFormat` with it, and stored on the user. A heartbeat's credited interval is placed on local days by a pure function that splits an interval that crosses local midnight, so no second lands on the wrong day. `WatchSession.day` is a calendar date in the learner's zone at the time of writing.

**Rationale**: `Intl` handles half-hour zones, DST and historic rules without a library. Splitting at midnight (rather than assigning a whole heartbeat to one day) keeps the midnight edge case exact.

**Consequence**: A day is fixed when written. If a learner moves to another zone, past days keep their recorded date and new time uses the new zone; nothing is lost or duplicated. The spec wording was adjusted to say this.

**Alternatives considered**: storing each heartbeat's UTC instant and bucketing at read time (the exact answer under zone changes, but the planning input specifies a `day` column and the rhythm query is simpler with it); a date library (not needed).

## 6. What makes a day count in the rhythm

**Decision**: A day is "watched" when the learner has at least 60 counted seconds on it for that language, or any added time. The grid is 8 week columns by 7 day rows, weeks starting on Monday, ending with the current week; days after today are drawn as not yet reached, never as missed.

**Rationale**: A one-minute floor stops an accidental play from marking a day, without needing a setting. Monday starts match the Done screen's Mon to Sun strip. Matches the approved layout.

**Alternatives considered**: any second counts (noisy); a share of the daily goal (would feel like a target and a failure state, against "nothing to lose").

## 7. Totals, stage progression and the estimate

**Decision**: Total seconds = sum of `WatchSession.seconds` plus added minutes times 60, per language. Stage rules live in a pure `stages.ts`. The language data lists the cumulative hours at which each stage is passed (`upToHours`) for Hear it, Follow it and Understand it; Join in has none. The server advances the stored stage inside the same transaction as the heartbeat or the added entry whenever total hours exceed the current stage's `upToHours`, in a loop for large additions, and never moves it back (including after removals). "About X more hours" is `ceil(upToHours - totalHours)` rounded to a friendly figure and shown only when the language provides the estimate; when the learner is past it, the line becomes encouraging copy with no number. The ring and bar show progress through the current stage, from the previous stage's threshold, clamped to 0 to 100%.

**Rationale**: Stage stored on `LearnerLanguage` (already there) keeps one source of truth and makes "never moves back" a plain property. Cumulative thresholds are the simplest data a content owner can adjust.

**Alternatives considered**: deriving the stage at read time from hours alone (would ignore the onboarding pick and could move back after a removal, both against the clarifications).

## 8. Placeholder estimates

**Decision**: `content/languages.json` gets, for Egyptian Arabic, `"roadmap": { "provisional": true, "note": "Placeholder estimates until product decides", "stages": [ { "stage": "HEAR_IT", "upToHours": 30 }, { "stage": "FOLLOW_IT", "upToHours": 100 }, { "stage": "UNDERSTAND_IT", "upToHours": 250 } ] }`. The schema requires `provisional` to be present so a final number cannot slip in unflagged, requires strictly increasing thresholds, and rejects any stage name outside the four. Coming-soon languages have no block.

**Rationale**: Constitution technical constraints: open decisions use clearly marked placeholders. Learner copy always says "an estimate", so showing a provisional number is honest.

**Alternatives considered**: hard-coding thresholds in code (breaks "languages are data").

## 9. Done for today

**Decision**: When a video ends, the client flushes its final heartbeat and calls `endOfVideo`. The server computes today's counted seconds for the language and compares it with `goal = minutesPerDay * 60` and the learner's `doneBlocks` for today. It answers "show" when `todaySeconds >= goal * (doneBlocks + 1)`, records `doneBlocks = floor(todaySeconds / goal)` for that local day, and the client navigates to the Done page. Otherwise the existing Up next flow continues. Nothing is ever shown while a video is playing. If Autoplay next is on, reaching the goal wins: Done shows instead of starting the next video, because every session must end.

**Rationale**: The server owns the numbers, so reloads and other devices agree. Storing blocks per day implements Clarification 1 with two small columns. Setting `doneBlocks` from the floor at show time means "I have a bit more time" needs no extra call.

**Alternatives considered**: deciding on the client from the last heartbeat response (race with the final flush); a separate "dismissed" flag (needs a second write and cleanup).

## 10. Showing hours in the header

**Decision**: A server component (`HoursPillSlot`, inside the existing Suspense) loads totals for all the learner's languages and passes them to the client `HoursPill`, which picks the language from the URL (the same rule `MainNav` uses) and falls back to the default language. The pill reads from a tiny external store, `store.ts`, seeded from that prop; each heartbeat response writes the new total into the store, so the pill moves while watching. Signed-out visitors keep the neutral pill without a number.

**Rationale**: Keeps the public shell static (spec 4's rule), avoids a context provider that would force the whole page dynamic, needs no polling, and adds no dependency.

**Alternatives considered**: `router.refresh()` after each heartbeat (re-renders the whole page every 15 seconds); a React context around the shell (forces dynamic rendering of everything).

## 11. Soft sound

**Decision**: One short, quiet chime file in `public/sounds/`. The watch counter plays it once when a heartbeat response reports a newly crossed whole hour (`chimedHours` stored on the language row so it never repeats, including after removals and across devices) and the learner's sound setting is on. The audio is created on the first user play gesture so browsers do not block it.

**Rationale**: Server-side `chimedHours` makes the chime exactly-once per hour and survives reloads. No audio library needed.

**Alternatives considered**: client-only tracking (replays after reload).

## 12. Settings and reminders

**Decision**: Minutes per day is per language and reuses the existing `updateProfile` action. Reminders and the hour sound are per account (`User.remindersOn`, `User.hourSound`, both default false) and saved through a new `saveSessionSettings` action. Reminders only store the choice; no code sends anything. The Roadmap screen shows toggles with `aria-pressed` and labels as in the design.

**Rationale**: Spec: reminders off by default and not sent; sound is a personal preference, not a language one. Reusing the existing profile action keeps one place that validates minutes (10, 20, 30, 60).

## 13. Library data

**Decision**: `PickUpBanner` receives the most recently updated, not-yet-watched `VideoProgress` for the language (position greater than zero), and each `VideoCard` receives `watched`. The learner-dependent part of the Library sits inside Suspense with a fallback that is today's static list, so the layout does not move. `watched` is set by a pure rule: position in the last 10% of the video, or the end reached (Clarification 2); once true it stays true.

**Rationale**: Reuses the pattern from spec 4 (dynamic read behind Suspense, public shell untouched). Signed-out visitors see no banner and no labels.

## 14. Next.js specifics

**Decision**: Mutations are server actions in `"use server"` files, each beginning with zod parsing and `requireLearner`; read paths are Server Components behind Suspense; pages that read the session stay dynamic exactly as in spec 4. The guides in `node_modules/next/dist/docs/01-app/01-getting-started/` (mutating data, caching, server and client components) were consulted for this version's conventions.
