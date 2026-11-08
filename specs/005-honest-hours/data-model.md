# Data Model: Honest Hours

Every learner-facing record carries a language code from `content/languages.json` (constitution IV). Every query is filtered by the signed-in learner's id taken from the session, never from the client.

## Prisma additions

```prisma
// Counted watch time: one row per learner, language, video and local day. `seconds` only goes up.
model WatchSession {
  id           String   @id @default(cuid())
  userId       String
  languageCode String
  videoSlug    String
  day          DateTime @db.Date   // the learner's local calendar day when the time was recorded
  seconds      Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, languageCode, videoSlug, day])
  @@index([userId, languageCode, day])
}

// Time the learner says they spent outside Instik. Always shown as "Added by you".
model ManualTime {
  id           String   @id @default(cuid())
  userId       String
  languageCode String
  day          DateTime @db.Date   // the local calendar day the learner chose
  minutes      Int
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, languageCode, day])
}

// Last position and "watched" for one video. Position is for resuming; `watched` never goes back to false.
model VideoProgress {
  id                  String   @id @default(cuid())
  userId              String
  languageCode        String
  videoSlug           String
  lastPositionSeconds Int      @default(0)
  watched             Boolean  @default(false)
  updatedAt           DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, languageCode, videoSlug])
  @@index([userId, languageCode, updatedAt])
}

// Makes a retried heartbeat count once. Rows older than two days are deleted by later heartbeats.
model HeartbeatReceipt {
  sessionId String
  seq       Int
  userId    String
  createdAt DateTime @default(now())

  @@id([sessionId, seq])
  @@index([createdAt])
}
```

`User` gains the relations (`watchSessions`, `manualTimes`, `videoProgress`) and two columns:

| Column | Type | Meaning |
|---|---|---|
| `timeZone` | `String?` | The learner's IANA zone as reported by their device; validated before saving. Null until first reported; server code treats null as `UTC` |
| `watchCountedUntil` | `DateTime?` | Watermark: the latest real instant already counted for this learner, across all languages and tabs. Only moves forward |

`LearnerLanguage` (spec 4) gains:

| Column | Type | Default | Meaning |
|---|---|---|---|
| `remindersOn` | `Boolean` | `false` | Stored only; nothing is sent in this release |
| `soundOn` | `Boolean` | `false` | Play the soft chime when a whole hour is added |
| `chimedHours` | `Int` | `0` | Highest whole hour already chimed or silently passed. Never decreases |
| `doneAckDay` | `DateTime? @db.Date` | null | Local day of the last "I have a bit more time" |
| `doneAckSeconds` | `Int` | `0` | Today's watched seconds at that moment |

`stage` (existing) now also advances with hours and never decreases. `minutesPerDay` (existing) is the daily goal; its allowed values stay 10, 20, 30, 60.

Deleting a user or a language profile removes the learner's hours: user rows cascade; when a profile is removed, the settings code deletes that learner's `WatchSession`, `ManualTime` and `VideoProgress` rows for the language in the same transaction (spec edge case "Language removed").

## Validation rules

| Field | Rule |
|---|---|
| `languageCode` | Exists in `content/languages.json`, is `available`, and the learner has a profile for it |
| `videoSlug` | Exists in that language's content; `durationSeconds` comes from content |
| `seconds` per heartbeat | Integer 0–120; clamped to `⌊windowMs ÷ 1000⌋`; then reduced to the part of the window after `watchCountedUntil` |
| `windowMs` | Integer 1–120 000 |
| `ageMs` | Integer 0–21 600 000 (6 hours); the window must not end more than 5 s after server `now` |
| `seq` | Integer ≥ 0, unique per `sessionId`; `sessionId` is a UUID |
| `positionSeconds` | Number ≥ 0, floored, and clamped to the video's duration |
| `timeZone` | Accepted only if `Intl.DateTimeFormat` can construct it; otherwise ignored and the saved zone is used |
| `ManualTime.minutes` | Integer 1–720 |
| `ManualTime.day` | `YYYY-MM-DD`; not after the learner's local today; not more than 365 days before it |
| `minutesPerDay` | One of 10, 20, 30, 60 |

## Derived values (never stored)

| Value | Definition |
|---|---|
| Watched seconds (language) | `SUM(WatchSession.seconds)` |
| Added seconds (language) | `60 × SUM(ManualTime.minutes)` |
| Total seconds | Watched + added, shown as hours and minutes (`12h 40m`); under an hour shows minutes |
| Today watched seconds | `SUM(WatchSession.seconds)` where `day` = learner's local today |
| Videos today | Count of distinct `videoSlug` with `seconds > 0` today |
| Days with time | Distinct `day` from `WatchSession` (seconds > 0) and `ManualTime` in the last 8 weeks |
| Current stage progress | See research 7: `(max(total, start) − start) ÷ (end − start)` hours, clamped |
| Done due | See research 9 |

## State transitions

**Heartbeat (server transaction)**

1. Lock the learner's row (`SELECT … FOR UPDATE` on `User`) so two tabs serialise.
2. Insert the `HeartbeatReceipt`; if `(sessionId, seq)` exists, stop and return the current summary.
3. Place the window on the server clock; cut it at `watchCountedUntil`; scale `seconds`.
4. Split by local day in the learner's zone; upsert `WatchSession` rows with `seconds = seconds + part`.
5. Upsert `VideoProgress` (position; `watched` set when the position reaches the last 10 % or `ended`, never unset).
6. Advance `watchCountedUntil`, save `timeZone` if it changed, raise `chimedHours`, advance `stage` if a threshold was passed.
7. Return the summary: `{ totalSeconds, todaySeconds, stage, hourAdded, doneDue }`.

**Stage**: `HEAR_IT → FOLLOW_IT → UNDERSTAND_IT → JOIN_IN`, forward only, and only when total hours ≥ that stage's estimate. The last stage has no end.

**Done for today**: `not due → due` when today's seconds reach the goal (or the goal plus the last acknowledged point); `due → not due` when the learner acknowledges; resets with the local day.

**Watched**: `false → true` only.

**Manual entry**: created, then optionally deleted by its owner. No edit.

## Relationships

```text
User 1 ──< WatchSession      (unique: user, language, video, day)
User 1 ──< ManualTime
User 1 ──< VideoProgress     (unique: user, language, video)
User 1 ──< LearnerLanguage   (spec 4; now holds settings, chime, Done acknowledgement)
HeartbeatReceipt              (sessionId, seq) -> userId, no relation, short lived
```

## Content addition (`content/languages.json`)

See [contracts/roadmap-content.md](contracts/roadmap-content.md). Read at build; not in the database.
