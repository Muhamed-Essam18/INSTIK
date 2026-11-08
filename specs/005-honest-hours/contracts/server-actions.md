# Contract: Server actions

Every action: (1) parses its input with zod, (2) calls `requireLearner()` and uses the session's user id, never an id sent by the client, (3) checks the language code belongs to one of the learner's profiles and the video slug exists, (4) returns a small typed result instead of throwing for expected problems. Error codes map to short, kind messages. None of these actions reads or writes another learner's data.

## Counting (`src/lib/hours/actions.ts`)

| Action | Input | Result | Rules |
|---|---|---|---|
| `recordHeartbeat` | `{ languageCode, videoSlug, seconds, spanSeconds, endedAgoSeconds, position, duration, timeZone }` | `{ ok: true, accepted, totalSeconds, todaySeconds, stage, chime }` or `{ ok: false, code: "no-profile" \| "unknown-video" \| "invalid" \| "rejected" }` | `seconds` and `spanSeconds` are numbers from 0 to 20; `endedAgoSeconds` from 0 to 86400; `position` and `duration` are non-negative. In one transaction with the language row locked: applies the interval rules in `counting-rules.md` (no overlap with `countedUntil`, not in the future, at most 20s, late intervals share a 300-second budget per 10 minutes) and accepts `min(seconds, spanSeconds, 20)`; a rejected interval changes nothing and answers `rejected`; splits the accepted interval across local days (using `timeZone`, validated and stored on the user); increments the matching `WatchSession` rows; updates `VideoProgress` (position clamped, `watched` by the 10% rule); sets `countedUntil` to the interval's end; advances the stage if total hours passed its estimate; reports `chime: true` only when a new whole hour was crossed and `hourSound` is on. A heartbeat of 0 seconds still updates position and watched |
| `endOfVideo` | `{ languageCode, videoSlug }` | `{ ok: true, showDone: boolean }` or `{ ok: false, code: "no-profile" \| "unknown-video" }` | Called after the final heartbeat when a video ends. Computes `showDone` from today's seconds, the goal and the day's `doneBlocks`; if true, records the new `doneBlocks` for today. Never called or honoured mid-video: it only acts when the video's recorded position is within the last 10% |

## Added time (same file)

| Action | Input | Result | Rules |
|---|---|---|---|
| `addManualTime` | `{ languageCode, minutes, day, timeZone }` | `{ ok: true, totalSeconds, stage }` or `{ ok: false, code: "invalid-minutes" \| "invalid-date" \| "too-many" \| "no-profile" }` | Limits from `manual-time.ts`: 1 to 600 whole minutes; date not in the future and within 365 days in the learner's zone; at most 20 entries per day and language. Advances the stage if the new total passes the estimate. Stores the entry flagged by being a `ManualTime` row |
| `removeManualTime` | `{ id }` | `{ ok: true, totalSeconds }` or `{ ok: false, code: "not-found" }` | Only entries owned by the learner. Lowers the total; never moves the stage back; never resets `chimedHours` |

## Time zone (same file)

| Action | Input | Result | Rules |
|---|---|---|---|
| `syncTimeZone` | `{ timeZone }` | `{ ok: true, changed }` or `{ ok: false, code: "invalid" }` | Validates the IANA name and stores it on the signed-in learner; `changed` tells the page whether to refresh. Called when the Roadmap or Done page loads |

## Settings (`src/lib/hours/settings-actions.ts`)

| Action | Input | Result | Rules |
|---|---|---|---|
| `saveSessionSettings` | `{ remindersOn?, hourSound? }` | `{ ok: true }` or `{ ok: false, code: "invalid" }` | Booleans on the signed-in learner. `remindersOn` only stores the choice; nothing is sent |
| `updateProfile` (existing, spec 4) | `{ languageCode, minutesPerDay }` | existing | Reused for "Done for today after"; minutes must be 10, 20, 30 or 60 |

## Client behaviour the actions rely on

- Counted time is kept in memory only, as a queue of timed intervals (at most 20 seconds each, at most 300 counted seconds in total; the excess is dropped). Intervals are sent oldest first, every 15 seconds and also on pause, tab hidden, video ended, navigation away and the browser's `online` event. A failed send keeps the interval and its order; a `rejected` answer drops that one interval.
- The end-of-video handler is one function in `PlaybackProvider`: it awaits the queue flush and `endOfVideo`, then chooses Done, autoplay-next or the فاهم؟ check, in that order of priority.
- The pill's store is updated from every successful `recordHeartbeat` and `addManualTime` / `removeManualTime` result.
- The Done page is reached only from a `showDone: true` answer after a video ends, or from the learner's own links ("See your roadmap" leads away from it; the Done route itself still renders for a signed-in learner who opens it).
- A failed action shows a short quiet note and never blocks playback.
