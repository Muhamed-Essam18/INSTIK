# Data Model: Accounts and Onboarding

Learner data lives in PostgreSQL through Prisma. Content stays in files. Language identity is the **language code** from `content/languages.json` (for example `arz`), never the URL slug, so a slug can change without touching learner data.

## Entities

### User *(Auth.js, extended only by the relations below)*
`id` (cuid), `name?`, `email` (unique), `emailVerified?`, `image?`, `createdAt`.
Relations: `accounts`, `sessions`, `languages` (LearnerLanguage), `answers` (ComprehensionAnswer).
Rules: created by Auth.js on the first successful sign-in (Google or email link). One user per email address. No password column exists.

### Account *(Auth.js)*
The link between a user and a sign-in provider (Google). Standard Auth.js fields (`provider`, `providerAccountId`, tokens). Unique on `(provider, providerAccountId)`. Deleted with the user.

### Session *(Auth.js)*
`sessionToken` (unique), `userId`, `expires`. Created on sign-in, deleted on sign-out. Lasts 30 days and refreshes while the learner keeps coming back (FR-012).

### VerificationToken *(Auth.js)*
`identifier` (the email), `token` (unique), `expires` (60 minutes after sending). Deleted when used, so a link works once (FR-007).

### LearnerLanguage *(the language profile)*
| Field | Type | Rule |
|---|---|---|
| `id` | cuid | |
| `userId` | → User | required; cascade delete |
| `languageCode` | string | must be a language in the language data whose status is available at the time of adding |
| `stage` | enum `Stage` | `HEAR_IT`, `FOLLOW_IT`, `UNDERSTAND_IT`, `JOIN_IN` |
| `minutesPerDay` | int | one of 10, 20, 30, 60 (checked in code with zod; the database stores the integer) |
| `createdAt`, `updatedAt` | timestamps | |

Constraints: **unique `(userId, languageCode)`** (FR-024). Index on `userId`.
Independence: updating one row never touches another (FR-025).
Later specs attach hours, rhythm and level to this row; this spec adds nothing else to it.

### Preference *(transcript layers, per profile)*
| Field | Type | Rule |
|---|---|---|
| `id` | cuid | |
| `learnerLanguageId` | → LearnerLanguage | **unique**, one set per profile; cascade delete |
| `layers` | JSON | object of layer name → boolean, validated against the language's `transcriptLayers` on every write (for Egyptian Arabic: `script`, `tashkeel`, `transliteration`, `english`) |
| `updatedAt` | timestamp | |

Defaults live in code (`DEFAULT_LAYERS`), so a missing row means "defaults" and no row is written until the learner changes something.

### ComprehensionAnswer *(the فاهم؟ answer, per video)*
| Field | Type | Rule |
|---|---|---|
| `id` | cuid | |
| `userId` | → User | cascade delete |
| `languageCode` | string | must match a profile the learner has |
| `videoSlug` | string | must be a video in that language's content |
| `answer` | enum `Understood` | `MOSTLY`, `SOME`, `NOT_YET` |
| `updatedAt` | timestamp | |

Constraints: **unique `(userId, languageCode, videoSlug)`**, so a changed answer replaces the old one. Index on `(userId, languageCode)`.
No score, no total, no history: only the current answer.

### SignInAttempt *(rate limit bookkeeping, not learner data)*
`id`, `key` (`email:<normalised>` or `visitor:<salted hash>`), `createdAt`. Index on `(key, createdAt)`. Rows older than a day are removed when new ones are added. Holds no profile or content data.

## Relationships

```text
User 1 ── * Account
User 1 ── * Session
User 1 ── * LearnerLanguage 1 ── 0..1 Preference
User 1 ── * ComprehensionAnswer
VerificationToken            (by email, not a foreign key; Auth.js)
SignInAttempt                (by key, standalone)
```

## Onboarding draft *(device only, not in the database)*

`{ step: 1-4, language?: code, level?: "none" | "few" | "slow" | "most", minutes?: 10 | 20 | 30 | 60 }`, stored in `localStorage` under `instik:v1:onboarding`.
- `level` is kept (not just the stage) so the screen can show the selected option again; `stage` is derived by `stageForLevel`.
- Valid until it becomes a `LearnerLanguage` or the learner clears the site; removed on successful completion and on sign-out.
- Anything that fails validation is discarded and the flow starts at the first missing step.

## State transitions

- **Visitor → learner**: first successful sign-in creates User (and Account for Google). A profile is created only by `completeOnboarding` or "Add a language".
- **Profile**: created (stage, minutes) → updated (either field, any time) → never deleted in this version.
- **Layers**: no row → row created on first change → updated on later changes.
- **Answer**: none → answered → replaced by a new answer.
- **Device choices**: present on device → imported once to the account → removed from the device.

## Validation summary

| Input | Rule |
|---|---|
| Email | trimmed, lower-cased, valid address, at most 254 characters |
| `languageCode` | exists in language data; available when adding a profile |
| `stage` | one of the four values |
| `minutesPerDay` | 10, 20, 30 or 60 |
| `layers` | only keys the language uses; all booleans |
| `answer` | one of the three values |
| `videoSlug` | exists for that language |
| `returnTo` | same-site path matching a known route shape |

## Prisma schema sketch

Shape only; the real file is written in the implementation.

```prisma
enum Stage { HEAR_IT FOLLOW_IT UNDERSTAND_IT JOIN_IN }
enum Understood { MOSTLY SOME NOT_YET }

model LearnerLanguage {
  id            String   @id @default(cuid())
  userId        String
  languageCode  String
  stage         Stage
  minutesPerDay Int
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  preference    Preference?
  @@unique([userId, languageCode])
}
```
