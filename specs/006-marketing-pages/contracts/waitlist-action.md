# Contract: `joinWaitlist` server action

Module: `src/lib/waitlist/actions.ts` (`"use server"`). Called by `WaitlistForm`.

## Input

```ts
{
  language: unknown;   // option code: a coming-soon language code, or "other"
  email: unknown;      // as typed
  website?: unknown;   // hidden trap field; must be empty
}
```

All fields are parsed with zod before use. Nothing from the client is trusted.

## Result

```ts
type JoinWaitlistResult =
  | { ok: true }
  | { ok: false; code: "invalid-email" | "invalid-language" | "too-many" | "failed" };
```

## Behaviour

| Case | Saves? | Result |
|---|---|---|
| Valid language and email, new pair | Yes, one row | `{ ok: true }` |
| Valid language and email, pair already listed (any letter case or spaces) | No | `{ ok: true }` (identical to the new case) |
| Same email, different language | Yes, a separate row | `{ ok: true }` |
| Trap field filled | No | `{ ok: true }` |
| Email missing or invalid | No | `invalid-email` |
| Language missing or not in options | No | `invalid-language` |
| More than 10 attempts in the last hour from this visitor | No | `too-many` |
| Database error | No | `failed` |

## Rules

- The result never says whether the pair already existed.
- No email is sent. No other data about the visitor is stored (only a salted hash of the address in the limit table).
- The limit is checked before the insert, and the attempt is recorded when the request is otherwise valid.

## Copy shown by the form (from `src/lib/marketing/copy.ts`)

| State | Text |
|---|---|
| Success | "Thank you. We'll write when your language is ready." |
| invalid-email | "That email doesn't look right. Could you check it?" |
| invalid-language | "Please pick a language." |
| too-many | "That's a lot of tries. Please wait a little and try again." |
| failed | "Something went wrong on our side. Please try again." |
| Note under the field | "We'll only use this to tell you when your language is ready." with a link to the Privacy page |
