# Contract: Server actions

All actions live in `src/lib/hours/actions.ts`. Each one: (1) parses its input with zod, (2) calls `requireLearner()` and uses the session's user id, never an id sent by the client, (3) checks that the learner has a profile for `languageCode`, (4) returns a small typed result instead of throwing for expected problems. Error codes map to short, kind messages.

## Shared result: `HoursSummary`

```ts
type HoursSummary = {
  totalSeconds: number;       // watched + added, this language
  watchedSeconds: number;
  addedSeconds: number;
  todaySeconds: number;       // watched today, local day
  stage: Stage;               // after any forward move
  hourAdded: boolean;         // true once per newly passed whole hour (heartbeat only)
  doneDue: boolean;           // the Done for today rule evaluated now
};
```

## Actions

| Action | Input | Result | Rules |
|---|---|---|---|
| `recordHeartbeat` | A [Heartbeat](counting-rules.md#heartbeat-wire-format) | `{ ok: true, summary }` or `{ ok: false, code: "invalid" \| "no-profile" \| "unknown-video" \| "too-old" }` | The transaction in [data-model.md](../data-model.md#state-transitions). Idempotent on `(sessionId, seq)`: a repeat returns `ok: true` with the current summary. A beat that is entirely overlap still returns `ok: true` and moves position and `watched` |
| `addManualTime` | `{ languageCode, minutes, date, timeZone? }` | `{ ok: true, summary }` or `{ ok: false, code: "invalid-minutes" \| "future-date" \| "too-old" \| "no-profile" }` | Minutes integer 1–720; `date` is `YYYY-MM-DD`, not after the learner's local today, not older than 365 days. Sets `chimedHours` silently. Calls `refresh()` |
| `removeManualTime` | `{ id }` | `{ ok: true, summary }` or `{ ok: false, code: "not-found" }` | Deletes only the learner's own entry (the query includes the user id, so another learner's id looks like not found). Stage and `chimedHours` are never lowered. Calls `refresh()` |
| `saveSessionSettings` | `{ languageCode, minutesPerDay?, remindersOn?, soundOn? }` | `{ ok: true }` or `{ ok: false, code: "invalid" \| "no-profile" }` | Updates only the named profile of the signed-in learner. `minutesPerDay` is one of 10, 20, 30, 60. Reminders store a flag only; nothing is sent |
| `acknowledgeDone` | `{ languageCode }` | redirect to the Library | Saves `doneAckDay = today` and `doneAckSeconds = todaySeconds` ("I have a bit more time"). The Done screen is next due after a further goal-sized block |
| `rememberTimeZone` | `{ timeZone }` | `{ ok: true }` or `{ ok: false, code: "invalid" }` | Saves `User.timeZone` when it is a valid IANA zone and differs from the saved one. Called by `TimeZoneSync` once per visit and shared by the other actions |

## Client behaviour the actions rely on

- Heartbeats are sent one at a time, in order. A failed call (network, server error) keeps the beat in the outbox, mirrored to `sessionStorage`, and retries on the next flush, on `online`, and on the next page load, always with the same `seq` and a fresh `ageMs`. An `invalid` or `unknown-video` result drops the beat so it cannot retry forever.
- On a successful heartbeat the hook writes `totalSeconds` to the Hours store (the header pill reads it) and, if `hourAdded` and the language's `soundOn` is true, plays the chime once.
- `doneDue` from the response to the `ended` flush decides whether to open the Done screen. If that request fails, the page applies the same pure rule locally.
- Add and remove time use a form with pending state; errors appear beside the field. After success the form clears and the page refreshes.

## Reads (Server Components, not actions)

`getHoursSummary(userId, languageCode, timeZone)` and `getRhythm(userId, languageCode, timeZone)` in `summary.ts`; `getProgressForLibrary(userId, languageCode)` in `store.ts` returning the watched slugs and the one unfinished video to pick up. Each filters by `userId`.

## Routes

No new routes. Existing pages change:

| Route | Change |
|---|---|
| `/learn/[language]/roadmap` | Real Roadmap (ring, stages, add time, entries, rhythm, settings) |
| `/learn/[language]/done` | Real Done for today (stats, this week, "See your roadmap", "I have a bit more time") |
| `/learn/[language]` | Banner and "Watched" from real progress for signed-in learners |
| `/learn/[language]/watch/[video]` | Starts at the saved position; runs the tracker |
| header (all pages) | Hours pill shows the language's total; nothing when signed out |

Access: roadmap, done and watch are already behind the proxy and `requireProfile`; the Library and header read the session inside `<Suspense>` and render the signed-out view without progress.
