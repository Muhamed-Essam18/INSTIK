# Contract: Counting rules

The behaviour the pure modules in `src/lib/hours/` must keep, and the test cases that prove it. These are the rules behind spec FR-001 to FR-003, FR-017, FR-018 and Clarification 3.

## Counter (`counter.ts`, client side)

Input: a stream of events with timestamps; output: counted seconds ready to send.

| Situation | Rule |
|---|---|
| Playing, tab visible, position advances in step with real time | Credit `min(elapsed wall time, position movement / rate)` for each `timeupdate` span |
| Paused, buffering (`waiting`), ended | No credit; the next sample after play starts a fresh baseline |
| Tab hidden (`visibilitychange`), muted or not | No credit while hidden; baseline reset when visible again |
| Seek (position jumps by more than `rate * elapsed + 0.75s`) in either direction | The jump adds nothing; baseline moves to the new position |
| Same whole media second as the last credited second | No credit |
| Playback rate changes (0.75, 1) | Rate used for the consistency check; credit still bounded by real time |
| Gap in events longer than 5 seconds of wall time (a frozen tab) | The gap is not credited |

Test cases (each a separate test): steady play for 60s credits 60s ±1; pause for 60s then play 10s credits 10s; hide for 30s mid-play credits nothing for the hidden span; seek forward 5 minutes credits nothing for the jump; seek back to the just-credited second and replay credits nothing for that second; a loop of a longer span credits real time; slow speed 0.75 for 60s of wall time credits about 60s; a 10-minute frozen-tab gap credits at most 5s; an out-of-order or negative-time event credits nothing.

## Heartbeat cap (`heartbeat.ts`, server side)

Input: an interval `{ seconds, spanSeconds, endedAgoSeconds }` plus the server's `now`, the row's `countedUntil`, and the late-window state (`lateWindowStart`, `lateSeconds`). Output: accepted seconds, the new `countedUntil`, and the new late-window state, or a rejection.

1. `end = now - endedAgoSeconds`, `start = end - spanSeconds`. Reject if any value is negative or not finite, `end > now + 2s`, `spanSeconds > 20`, or `endedAgoSeconds > 24h`.
2. Reject if `countedUntil` is set and `start < countedUntil - 2s (network-jitter tolerance)` (overlap or out of order).
3. `accepted = max(0, min(seconds, spanSeconds, 20))`.
4. If `endedAgoSeconds > 30` the interval is late: if the window started more than 10 minutes ago, reset it; accept only `min(accepted, 300 - lateSeconds)` and add that to `lateSeconds`.
5. On acceptance `countedUntil = end`.

Test cases: an honest live 15s interval ending now is accepted in full; a claim larger than its own span is cut to the span; a span over 20 is rejected; an interval that starts before `countedUntil` (a second device counting the same moment) is rejected and changes nothing; many 20s intervals all ending "now" cannot add more than real time (the second is rejected as overlapping); an interval ending in the future is rejected; an out-of-order interval is rejected and does not break the next valid one; a first-ever interval is accepted; negative or non-finite values are rejected.

Offline queue cases: a 5-minute offline session sent in order on reconnect is accepted in full (300 counted seconds); a 20-minute offline session sends the first 300 seconds and the rest is dropped (client) or not counted (server); a second reconnect inside the same 10-minute window adds nothing more past 300 late seconds; a new window after 10 minutes resets the budget; an interval older than 24 hours is rejected; replaying the same queue twice counts it once (the overlap rule).

## Days (`days.ts`)

`splitByLocalDay(startInstant, seconds, timeZone) -> [{ day, seconds }]`.

Test cases: an interval inside one day returns one entry; an interval crossing local midnight in New York, Cairo, Auckland, and a half-hour zone (Kolkata) splits exactly at local midnight and the parts sum to the total; a 45-minute-offset zone (Kathmandu); the day a DST change happens (23-hour and 25-hour days); an invalid time zone name is rejected and not stored; the instant 23:59:50 local with 20s credited gives 10s on each day.

## Totals, stage and rhythm

- `totals.ts`: total = watched + added; formatting `12h 40m`, `0h 0m`, `45 min`; sub-minute remainders are kept in seconds, not lost.
- `stages.ts`: `advanceStage(current, totalHours, estimates)` moves forward through several stages for a large addition, never backward, and stays put when `estimates` is absent; `moreHours` is omitted without an estimate, and never negative.
- `rhythm.ts`: always 8 columns of 7 days, Monday first, ending with the current week; a day with 59 counted seconds is a rest day, 60 is watched, any added time is watched; future days are flagged not-yet-reached; correct for a learner whose "today" differs from UTC's today.
- `goal.ts`: `shouldShowDone(todaySeconds, goalSeconds, doneBlocks)` is true exactly when `todaySeconds >= goalSeconds * (doneBlocks + 1)`; false for a goal of zero input; resets on a new local day.
- `watched.ts`: true at position >= 90% of the duration or at the end; unknown duration is never watched; once true stays true.
- `manual-time.ts`: rejects 0, negative, fractional, above 600, non-numeric minutes; rejects a future date and a date older than 365 days (decided in the learner's zone, including the edge where it is already tomorrow in UTC).

All of these are plain functions with no framework imports, so each test is a few lines.
