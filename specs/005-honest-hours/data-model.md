# Data Model: Honest Hours

Learner data lives in PostgreSQL through Prisma. Stage estimates live in `content/languages.json`. Every row carries a `languageCode` from that file, so nothing here is specific to one language.

## New models

### WatchSession

Counted watching for one learner, language and video on one local day. One row per combination; heartbeats add to `seconds`.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| userId | String | relation to User, cascade on delete |
| languageCode | String | from `content/languages.json` |
| videoSlug | String | must be a video of that language |
| day | Date (date only) | the calendar day in the learner's time zone when it was written |
| seconds | Int | counted seconds, never negative |
| updatedAt | DateTime | |

Unique: `(userId, languageCode, videoSlug, day)`. Index: `(userId, languageCode, day)` for totals and rhythm.

### ManualTime

Time the learner says they spent outside Instik. Always shown as "Added by you".

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| userId | String | cascade on delete |
| languageCode | String | |
| day | Date (date only) | the date the learner entered |
| minutes | Int | 1 to 600 |
| createdAt | DateTime | |

Index: `(userId, languageCode, day)`. Rules (pure, tested): minutes is a whole number from 1 to 600; the date is not after today in the learner's zone and not more than 365 days before it; at most 20 entries per learner and language per day.

### VideoProgress

Where the learner is in one video. Drives "pick up where you left off" and the "Watched" label.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| userId | String | cascade on delete |
| languageCode | String | |
| videoSlug | String | |
| positionSeconds | Int | last reported position, clamped to the duration |
| watched | Boolean | set when position reaches the last 10% or the end; once true it stays true |
| updatedAt | DateTime | |

Unique: `(userId, languageCode, videoSlug)`. Index: `(userId, languageCode, updatedAt)`.

## Changed models

### LearnerLanguage (one row per learner per language, from spec 4)

| New field | Type | Notes |
|---|---|---|
| countedUntil | DateTime? | end of the last accepted counted interval (server time); a new interval may not start before it, across all devices |
| lateWindowStart | DateTime? | start of the current 10-minute window for late (queued) intervals |
| lateSeconds | Int, default 0 | counted seconds accepted from late intervals in that window; at most 300 |
| chimedHours | Int, default 0 | highest whole hour already announced with the chime; never decreases |
| doneDay | Date? | the local day `doneBlocks` refers to |
| doneBlocks | Int, default 0 | goal-sized blocks already acknowledged on `doneDay` |

`stage` (existing) now also advances with hours and never moves back. `minutesPerDay` (existing) is the daily goal.

### User (Auth.js, from spec 4)

| New field | Type | Notes |
|---|---|---|
| timeZone | String? | validated IANA name; absent means UTC until the first heartbeat or added time |
| remindersOn | Boolean, default false | stored only; nothing is sent in this release |
| hourSound | Boolean, default false | play one soft chime when an hour is added |

## Content (not database)

`content/languages.json`, per available language:

```json
"roadmap": {
  "provisional": true,
  "note": "Placeholder estimates until product decides",
  "stages": [
    { "stage": "HEAR_IT", "upToHours": 30 },
    { "stage": "FOLLOW_IT", "upToHours": 100 },
    { "stage": "UNDERSTAND_IT", "upToHours": 250 }
  ]
}
```

Validation at build time: `provisional` must be present; stages unique, in the order Hear it, Follow it, Understand it; `upToHours` positive and strictly increasing; Join in has no entry.

## Derived values (computed, never stored)

- **Total seconds** (per language) = sum of `WatchSession.seconds` + sum of `ManualTime.minutes` times 60. Watched and added time are also returned separately (FR-007).
- **Today's seconds** = counted watching with `day` equal to today in the learner's zone. Time added from outside Instik is not included: Done for today is about watching, so added time never reaches the daily goal (it still counts toward total hours and marks the day in the rhythm).
- **Videos today** = number of distinct `videoSlug` among today's `WatchSession` rows with counted seconds (a partly watched video counts; one with no counted time does not).
- **Rhythm** = for each of the last 8 weeks, 7 days: watched when the day has at least 60 counted seconds or any added time; future days marked not yet reached.
- **This week** (Done screen) = the current Monday to Sunday strip from the same data.
- **Stage progress** = clamp((total hours - previous stage's `upToHours`) / (this stage's `upToHours` - previous), 0, 1).
- **Pick up** = newest `VideoProgress` for the language with `watched = false` and `positionSeconds > 0`.

## State transitions

- **Stage**: `HEAR_IT -> FOLLOW_IT -> UNDERSTAND_IT -> JOIN_IN`, only forward. A step happens in the same transaction as a heartbeat or an added entry when total hours exceed the current stage's `upToHours`. Removing added time lowers the total but never changes the stage.
- **Chime**: `chimedHours` rises to `floor(total hours)` when a heartbeat crosses a whole hour; the response says whether to chime (only if `hourSound` is on). It never decreases.
- **Done blocks**: when a video ends and `todaySeconds >= goal * (doneBlocks + 1)`, the server sets `doneDay` to today and `doneBlocks = floor(todaySeconds / goal)`. On a new local day `doneBlocks` is treated as 0.
- **Watched**: `watched` flips to true once and stays.

## Removal

Hour rows (`WatchSession`, `ManualTime`, `VideoProgress`) are removed only when the account is deleted (cascade). There is no way to remove a language profile in this release.
