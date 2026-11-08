# Research: Honest Hours

All unknowns from the Technical Context are resolved below. Each entry: decision, why, what else was weighed.

## 1. What counts, and how the client decides

**Decision**: A pure tracker receives events (`playing`, `pause`, `waiting`, `seeking`, `seeked`, `ended`, `ratechange`, `timeupdate`, visibility change) each stamped with the media position and a monotonic clock reading (`performance.now()`). Time is counted **by media progress, capped at real time**. On each `timeupdate` while state is *playing and visible*:

- `wall` = clock delta, `media` = position delta, `expected` = `wall × playbackRate`.
- `media < 0` or `media > expected + 0.75 s` is a **jump** (a seek the events missed): count 0 and rebase.
- A gap with no events longer than 5 s (sleep, frozen tab) counts 0 and rebases.
- Otherwise count `min(media ÷ rate, wall)`. A stall that fires no `waiting` event (media moved less than expected) therefore counts only what really played, and a repeated identical `currentTime` counts 0.

Pause, `waiting`, `seeking`, `ended` and a hidden tab move the state out of *counting*; `playing` plus visible moves it in, rebasing the position so the seek-or-pause gap is never charged. A muted video in a visible tab still counts (the learner is reading the transcript); a muted video in a hidden tab does not, because hidden does not count (spec scenario 4 is covered by visibility).

**Consecutive repeat of the same second** (FR-003): the tracker remembers the span of the most recent counted run, `[from, to]`. After a seek whose target lies inside that span, playback up to `to` adds nothing (`skipUntil = to`). When playback passes `to`, counting resumes and the new run becomes the remembered span. Replaying later, after any run that went past the span, counts normally (spec edge case: ordinary re-watching adds time). The memory lives in the tab, so a reload forgets it; this can only over-count one repeated span after a reload, and is accepted.

**Why this and not "sum wall time while `!paused`"**: wall-time counting charges buffering, stalls and seek spans; media-progress counting capped at wall time is the stricter reading of "actually playing", and it is a pure function of events, so it can be tested without a browser. **Why `timeupdate` and `playing` and not `requestAnimationFrame`/intervals**: they are the player's own signals, fire for both the native `<video>` and the Mux element through the shared `PlayableMedia` interface, and do not run in hidden tabs.

**Alternatives**: counting `setInterval` ticks while `!paused` (inflates on buffering, runs in hidden tabs, needs clock-drift fixes); listening to `ontimeupdate` only and trusting `currentTime` deltas (counts seeks as playback).

## 2. Heartbeat: durations, not timestamps

**Decision**: The tracker accumulates counted milliseconds and **flushes every 15 s of counted time** (checked on `timeupdate`), and on pause, `waiting` longer than a moment, hide, `ended`, unmount and `pagehide`. A heartbeat carries `{ sessionId, seq, languageCode, videoSlug, seconds, windowMs, ageMs, positionSeconds, ended, timeZone }`:

- `seconds` whole counted seconds; the sub-second remainder stays in the tracker for the next beat (nothing is lost to rounding, spec edge case "display rounding").
- `windowMs` = how much real time the beat covers (since the previous beat ended); `ageMs` = how long ago that window ended when the beat is sent.

The server computes `end = now − ageMs`, `start = end − windowMs` on **its own clock**. The client's wall clock and its time zone setting therefore cannot create or erase time (spec edge case), and a beat that waited offline is still placed correctly. A progress-only beat (`seconds = 0`) is allowed so a pause or seek can save the position.

**Why durations**: client timestamps would trust the device clock and break on clock changes. **Alternatives**: sending `Date.now()` ranges (trusts the device, DST/clock edits corrupt it); sending one session total (cannot be capped per window or placed on a day).

## 3. Server action, and what is lost when the tab closes

**Decision**: Heartbeats use a **server action**, as requested. Actions run one at a time per client, so beats arrive in order. Failures keep the beat in an in-memory outbox that retries with the same `seq` (see 5), and the outbox also survives a reload through `sessionStorage` so time counted just before a connection loss is not dropped. Closing the tab can lose the unsent remainder of the current 15 s window (at most 15 s counted, never invented), which errs on the honest side. `pagehide` still tries one last flush.

**Alternatives**: `navigator.sendBeacon` or `fetch(..., { keepalive: true })` to a route handler would save the last window more reliably, but add a second ingestion path with its own auth and validation. Rejected for this release; the 15 s bound is small and the task note records it as a possible follow-up.

## 4. Server rules for a heartbeat

**Decision** (all in the pure `heartbeat.ts`, tested): parse with zod (`seconds` 0–120, `windowMs` 1–120 000, `ageMs` 0–6 h, `seq` ≥ 0, position ≥ 0, slugs and IANA zone validated); **clamp** `seconds` to `⌊windowMs ÷ 1000⌋` ("caps each heartbeat at its elapsed time"); place the window on the server clock; reject a window that ends more than 5 s in the future or starts before the 6 h limit; **cut the window to start no earlier than the learner's `watchCountedUntil` watermark** and scale `seconds` to the surviving window; advance the watermark to `max(old, end)`.

The watermark is per learner, not per language: one person cannot watch two things at once, so overlapping playback in two tabs, two videos or two devices counts each real moment once (clarification: overlapping playback is not added twice). A late beat from an offline tab that falls entirely before the watermark is dropped; this errs on the honest side and is the price of the simple rule.

The check is not an anti-cheat measure. A learner who forges requests can only inflate their own number, while the limits stop bugs, retries and parallel tabs from doing it accidentally.

**Alternatives**: store every beat as an interval and union at read time (exact but one row per beat, heavy to aggregate and re-bucket); a per-second bitmap per hour (exact, but disproportionate for the benefit).

## 5. Idempotency

**Decision**: `HeartbeatReceipt (sessionId, seq)` is inserted in the same transaction as the counted seconds. A repeated `(sessionId, seq)` hits the unique key and returns the current totals without counting again, so a retry after a lost response never double counts (FR-017). Receipts older than 2 days are deleted opportunistically in the same transaction (one `deleteMany` on an indexed `createdAt`), so no scheduled job is needed. `sessionId` is a random UUID per player mount.

## 6. The `WatchSession` shape and day bucketing

**Decision**: One row per **learner, language, video and local day** (`@@unique`) with an incrementing `seconds`, exactly the requested fields. A beat that crosses local midnight is split into per-day parts by wall overlap with the learner's IANA time zone (largest-remainder rounding, so the parts add up to the counted seconds). `day` is a calendar date computed with `Intl.DateTimeFormat` in that zone, so DST changes, half-hour offsets and +14/−11 zones are handled by the platform's time zone data, not by arithmetic. Calendar-day arithmetic (add days, start of week) works on plain `YYYY-MM-DD` values in UTC so it is never affected by DST.

**Time zone changes**: `day` is fixed when the time is recorded, in the zone the learner had then. After a zone change, new time lands on the new zone's days and nothing is lost, but days already recorded keep their date (at most one day of drift at the edge of the 8-week window, and only for the learner who travelled). Re-bucketing history would need per-beat timestamps, which this model deliberately does not keep. **This narrows spec scenario US4-5 ("days are grouped by their current time zone") to "new time uses the current zone; no time is lost"; it is flagged in the plan report for the owner to accept or to change the wording.**

**Where the zone comes from**: the device (`Intl.DateTimeFormat().resolvedOptions().timeZone`), sent with every heartbeat and reported once per visit by a small `TimeZoneSync` for people who are not watching, and saved on `User.timeZone`. Server pages use the saved zone and fall back to UTC until it is known. Anything invalid is ignored.

## 7. Totals, today and the stage

**Decision**: Total seconds = `SUM(WatchSession.seconds) + 60 × SUM(ManualTime.minutes)` for the language, computed on read (no stored counter that could drift). Today = the same filtered to today's local day, watched time only (a day the learner adds outside time counts toward rhythm, per spec US3-5, but **not** toward the Done-for-today goal, which is about watching in the product). Videos today = distinct videos with `seconds > 0` today.

**Stage** (FR-009a, 009b): stored on `LearnerLanguage.stage`. On each heartbeat and each summary read, `advanceStage(stage, totalHours, estimates)` moves it forward while `totalHours ≥ endsAtHours[stage]` and persists the change; it never moves back, so removing added time cannot undo it. Remaining hours = `endsAtHours[stage] − max(totalHours, startOfStage)` (where `startOfStage` is the previous stage's end, or 0), so a learner who starts at Follow it with no hours sees the length of that stage, not a number inflated by the stage below. The ring and bar show `(max(total, start) − start) ÷ (end − start)`, clamped to 0–1. With no estimate for the last stage ("Join in") or a language without estimates, the line is omitted and the ring reads full or empty without negative or "overdue" figures.

## 8. Estimates in `content/languages.json`

**Decision**: Add an optional `roadmap` object per language:

```json
"roadmap": {
  "status": "placeholder",
  "note": "PLACEHOLDER estimates until decided (docs/product.md, Still to decide). Cumulative hours at which each stage ends.",
  "stageEndsAtHours": { "HEAR_IT": 30, "FOLLOW_IT": 100, "UNDERSTAND_IT": 250 }
}
```

The schema requires `status` (`"placeholder"` or `"decided"`), a non-empty `note` while the status is `placeholder`, and strictly increasing positive numbers; keys are the existing stage ids. Spanish has no block, so its "more hours" line is omitted. The numbers are invented placeholders and say so in three places: the status, the note and this plan. The UI never shows the word "placeholder"; it says "an estimate". They sit behind `getRoadmapEstimates(language)` so the decision, when made, is a data change (constitution technical constraint: open decisions use marked placeholders behind a thin interface).

**Alternatives**: a separate `content/roadmap.json` (a second source for one language property); a hard-coded constant (violates principle IV).

## 9. Done for today

**Decision**: Pure rule `isDoneDue({ todaySeconds, goalSeconds, ack })`, where `ack = { day, seconds } | null` is the point at which the learner last chose "I have a bit more time" today. Due when `todaySeconds ≥ goalSeconds` and, if an acknowledgement exists for today's local day, `todaySeconds ≥ ack.seconds + goalSeconds` (spec clarification: after each further full goal-sized block). A new day, or no acknowledgement, means the plain goal applies; a changed goal applies from the next video (`goalSeconds` is read fresh). The acknowledgement is stored on `LearnerLanguage` (`doneAckDay`, `doneAckSeconds`) so it follows the learner across devices.

**Where it is checked**: every heartbeat response includes `doneDue` computed on the server. On the `ended` event `PlaybackProvider` first flushes the tracker and awaits that response, then routes to the Done screen if due; if the request fails, it falls back to the same pure rule using the counts the page started with plus what the tracker has counted. It is checked **only on `ended`, never during playback** (SC-004), and takes precedence over autoplay-next. The Done page itself renders real figures whenever it is opened.

## 10. Chime and the header total

**Decision**: `LearnerLanguage.chimedHours` is the highest whole hour already celebrated. A heartbeat (or manual add) that raises `⌊total ÷ 3600⌋` above it returns `hourAdded: true` once and raises the stored value; it never lowers, so removed time cannot replay a chime. Only a heartbeat can ask for a chime, and the client plays it only when `soundOn`. The sound is a ~0.4 s soft two-note sine tone from the Web Audio API, started from a context created on the first `playing` event (a user gesture), with no file and no dependency. Added time updates `chimedHours` silently.

The header Hours pill sits in the static shell, so it cannot know the language on the server. A server slot inside `<Suspense>` loads totals for **all** of the learner's languages (one grouped query) and passes them to a client pill, which picks the language from the URL (`languageSlugFromPathname`, as `MainNav` already does) and otherwise shows the first profile. A heartbeat response writes the new total to a small client store (`useSyncExternalStore`), so the pill updates within one beat (SC-002) without polling or a context spanning Suspense boundaries. Signed-out visitors render nothing.

## 11. Library and resume

**Decision**: `VideoProgress` stores `lastPositionSeconds` and `watched`. The server marks `watched` when the reported position is at least 90 % of the video's duration (from content, never trusted from the client) or an `ended` beat arrives, and **never unmarks it**. The Library banner shows the most recently updated **unwatched** video with a position above 5 s; the watch page seeks to that position (minus 2 s of lead-in) before playing, and to 0 for a watched video. The Library overlays `watched` onto the existing `getLibraryVideos` list in a pure function. Signed-out visitors get neither (the page already requires an account to watch).

## 12. Added time

**Decision**: `addManualTime({ languageCode, minutes, date })` with minutes 1–720 as an integer and a calendar date no later than the learner's local today and no more than 365 days earlier. The date means the learner's local calendar day, stored as a date with no time zone. Entries are always labelled "Added by you", are listed separately from watched time, and can be removed only by their owner. Removing lowers the total but never moves the stage or replays a chime (7, 10). Rhythm counts a day with watched time or added time.

## 13. Rhythm

**Decision**: 8 columns (weeks, Monday first, ending with the current week) by 7 rows, 56 cells; each cell is `watched`, `rest` or `future` (dashed, never styled as missed), with `today` marked. It is computed from the set of local days with any watched or added time. The component renders an accessible text alternative (a list of watched dates grouped by week) as well as the picture, because the design's grid is `role="img"`. There is no streak, no count of rest days and no message that varies with missed days anywhere in the code, and a test scans the new learner-facing strings for the words streak, missed (except the approved line), lost and level names.

## 14. Settings

**Decision**: `saveSessionSettings({ languageCode, minutesPerDay?, remindersOn?, soundOn? })` updates only the learner's profile row. Minutes reuse `MINUTES = [10, 20, 30, 60]` from the profile rules so Settings and Roadmap cannot disagree. Reminders default off and nothing reads the flag to send anything. Toggles are `button role="switch"` elements with `aria-checked`, 44px tall.

## 15. Next.js 16 specifics checked

- Server actions run sequentially from a client and are the supported mutation path; they can call `refresh()` from `next/cache` to refresh the client router after a mutation, which the add/remove time actions use. Hours are read dynamically (session), so there is no `'use cache'` data to tag; the roadmap pages are inside the existing `<Suspense>` boundaries.
- `proxy.ts` already guards the roadmap and done routes; actions re-check with `requireLearner`.
- Cache Components rule: nothing reads the session or the time outside a Suspense boundary or an action.
