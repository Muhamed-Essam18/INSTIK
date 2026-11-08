# Contract: Counting rules

Two pure modules, both covered by unit tests: the **tracker** (`src/lib/hours/counting.ts`, runs in the browser) and the **heartbeat rules** (`src/lib/hours/heartbeat.ts`, runs on the server). Neither imports React, Next or Prisma.

## Tracker: states and events

State is `idle`, `counting`, or `held` (playing but not visible). The tracker holds: counted milliseconds not yet sent, the last position and clock reading, the playback rate, the span of the last counted run (`lastRun`), and `skipUntil`.

Every input carries `{ position (seconds), now (monotonic ms) }`.

| Event | Effect | Counted |
|---|---|---|
| `playing` and tab visible | → `counting`; rebase position and clock | 0 |
| `playing` and tab hidden | → `held`; rebase when the tab becomes visible | 0 |
| `timeupdate` while `counting` | See the tick rule below | per rule |
| `timeupdate` while `idle` or `held` | Nothing | 0 |
| `pause` | → `idle`; close the run | 0 |
| `waiting` (buffering) | → `idle`; `playing` resumes it | 0 |
| `seeking` | → `idle`; close the run. If the target lies inside `lastRun`, set `skipUntil = lastRun.to` | 0 |
| `seeked` | Rebase position and clock; back to `counting` if the media is playing and the tab is visible | 0 |
| `ratechange` | Store the new rate; rebase | 0 |
| `ended` | → `idle`; mark ended for the next flush | 0 |
| Tab becomes hidden | `counting` → `held`; close the run | 0 |
| Tab becomes visible | `held` → `counting` if the media is still playing; rebase | 0 |
| `emptied` or unmount | → `idle` | 0 |

### Tick rule (`timeupdate` while `counting`)

```text
wall     = now − lastNow                    (ms, monotonic clock)
media    = position − lastPosition          (s)
expected = wall × rate

if wall > 5000 ms                    -> count 0, rebase           (frozen tab, sleep)
else if media < 0 or media > expected + 0.75 s
                                     -> count 0, rebase           (a seek the events missed)
else
    played = min(media ÷ rate, wall)        (never more than real time)
    if skipUntil set and position ≤ skipUntil
        -> count 0                                                (consecutive repeat)
    else
        if skipUntil set: played = the part after skipUntil; clear skipUntil
        count played; extend lastRun to position
rebase to (position, now)
```

When a run ends and a later run started past `lastRun.to`, `lastRun` is replaced by the new run; replaying an old span after that counts normally.

### Flush

The tracker exposes `takeBeat(now)` which returns a beat or nothing:

- `seconds` = whole seconds of counted time; the sub-second remainder stays.
- `windowMs` = clock time since the previous beat ended (at least 1).
- `ageMs` = 0 at the moment of sending (the hook sets it from the current clock when the beat is queued and again on every retry).
- `positionSeconds`, `ended`.

It is called when 15 s of counted time is pending (checked on `timeupdate`) and on pause, `waiting` after 2 s, hidden, `ended`, unmount and `pagehide`. A flush with `seconds = 0` is sent only when the position changed by more than 2 s or `ended` is true.

## Heartbeat wire format

```ts
type Heartbeat = {
  sessionId: string;      // UUID, per player mount
  seq: number;            // 0, 1, 2, ... per sessionId; retries reuse it
  languageCode: string;
  videoSlug: string;
  seconds: number;        // whole counted seconds, 0..120
  windowMs: number;       // real time this beat covers, 1..120000
  ageMs: number;          // how long ago that window ended, 0..21600000
  positionSeconds: number;
  ended: boolean;
  timeZone: string;       // IANA, e.g. "Africa/Cairo"
};
```

No wall-clock timestamps are sent, so the device clock cannot create or erase time.

## Server rules (pure `applyHeartbeat`)

Inputs: the parsed beat, server `now`, the learner's `watchCountedUntil`, the learner's saved `timeZone`.

1. **Validate** with zod; invalid beats are refused and change nothing (`invalid`).
2. **Clamp**: `seconds = min(seconds, ⌊windowMs ÷ 1000⌋)`.
3. **Place**: `end = now − ageMs`; `start = end − windowMs`. Refuse if `end > now + 5 s` (can't happen with a non-negative `ageMs`, kept as a guard) or `ageMs` exceeds 6 h.
4. **No double counting**: `start' = max(start, watchCountedUntil)`. If `end ≤ start'` the whole window was already counted: `seconds = 0`. Otherwise `seconds = min(seconds, ⌊(end − start') ÷ 1000⌋)`. New watermark = `max(watchCountedUntil, end)`.
5. **Day split**: the surviving window `[start', end]` is cut at each local midnight in the learner's zone; `seconds` is divided across the parts in proportion to their overlap, using largest-remainder so the parts sum to `seconds`.
6. **Return** `{ parts: [{ day, seconds }], newWatermark, position, ended }`.

A repeated `(sessionId, seq)` is detected by the receipt table before step 3 and returns the current summary.

## Test matrix (all pure, no browser)

| Group | Cases |
|---|---|
| Pause | Play 10 s, pause 60 s, play 5 s counts 15 s; `waiting` is treated like pause |
| Seek | Forward and backward seek count nothing for the jump; counting resumes at the new position; a seek the events missed is caught by the media-versus-wall check |
| Hidden tab | Play 10 s visible, 30 s hidden, 10 s visible counts 20 s; a tab hidden and shown without a `playing` event resumes only if still playing; muted and hidden counts 0 |
| Repeat | Replaying the same span straight after counting it adds 0; replaying it after playing past it adds time; the first new second after `skipUntil` counts |
| Rate | At 0.75× real time counts equal wall time, not media time; a stall with no `waiting` event counts only what moved |
| Gap and cap | A 30 s event gap counts 0; one tick never counts more than its wall time; a beat's `seconds` is capped at `windowMs`; the sub-second remainder carries |
| Server | Clamp, future guard, over-age refusal, window cut at the watermark, two overlapping tabs count the union once, retried `seq` counts once |
| Day bucketing | A window crossing local midnight splits correctly in UTC, Africa/Cairo (with and without DST), Asia/Kolkata (+5:30), Pacific/Kiritimati (+14), Pacific/Pago_Pago (−11), America/St_Johns, Europe/London on both DST change nights; parts always sum to the total; the same instant lands on different days in different zones |
