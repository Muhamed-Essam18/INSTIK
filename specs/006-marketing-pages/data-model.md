# Data Model: Marketing Pages

## WaitlistEntry (new, database)

One visitor's request to hear about one language.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | Primary key |
| languageCode | string | A language `code` from `content/languages.json` with status `coming-soon`, or `other` |
| email | string | Trimmed, lower-cased, valid, at most 254 characters |
| createdAt | datetime | Default now; the date joined |

- **Unique**: `(languageCode, email)`. A repeat is a successful no-op.
- **Index**: `languageCode` (to count or export by language later).
- **No foreign keys**: visitors are not learners; entries are not tied to accounts.
- **Never stored**: names, addresses, user agents, or anything else about the visitor.
- **Not in `content/`**: learner and visitor data lives in the database only.

```prisma
model WaitlistEntry {
  id           String   @id @default(cuid())
  languageCode String
  email        String
  createdAt    DateTime @default(now())

  @@unique([languageCode, email])
  @@index([languageCode])
}
```

## Send-limit bookkeeping (existing `SignInAttempt`, reused)

Rows with `key = "waitlist:visitor:<salted hash>"` and `createdAt`. A visitor may make 10 waitlist attempts per rolling hour. Rows older than a day are deleted when new ones are written, as for sign-in links. The comment on the model is updated to mention the waitlist.

## Language data (existing, extended)

`content/languages.json` gains one entry: French (`fr`, slug `french`, `coming-soon`, Latin script, LTR, same shape as Spanish). No schema change.

## Derived, not stored

- **Waitlist options**: `coming-soon` languages in data order, then `{ code: "other", name: "Other" }`.
- **Stage estimate label**: from the available language's `roadmap`; placeholder when missing or `provisional`.
- **Start destination**: onboarding when signed out, `/learn/<default language slug>` when signed in.

## State and validation summary

| Input | Rule | Result on failure |
|---|---|---|
| email | trim, lower-case, valid address, 254 max | `invalid-email` |
| language | one of the options above | `invalid-language` |
| trap field | must be empty | silently treated as success, nothing saved |
| attempts | at most 10 per visitor per hour | `too-many` |
| database error | any | `failed` |
