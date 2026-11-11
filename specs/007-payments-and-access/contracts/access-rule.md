# Contract: access rule

Module: `src/lib/billing/access.ts`. Pure: no database, no Stripe, no `server-only` import, so it is tested directly and usable in components that receive its result.

## Types

```ts
type SubscriptionStatus =
  | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "TRIALING" | "ACTIVE"
  | "PAST_DUE" | "CANCELED" | "UNPAID" | "PAUSED";

type SubscriptionFacts = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};
```

## Functions

```ts
/** True when this subscription gives Full access at `now`. A missing subscription gives none. */
hasFullAccess(subscription: SubscriptionFacts | null | undefined, now: Date): boolean

/** True when the learner may play this video and read its transcript. */
canWatch(video: { access: string }, subscription: SubscriptionFacts | null | undefined, now: Date): boolean
```

## Rules

| Input | `hasFullAccess` |
|---|---|
| `null` / `undefined` | false |
| `ACTIVE`, period not ended | true |
| `ACTIVE`, `cancelAtPeriodEnd` true, period not ended | true (cancelled before period end) |
| `ACTIVE`, period ended up to 7 days ago | true (renewal not yet recorded) |
| `ACTIVE` or any status, period ended more than 7 days ago | false (safety net) |
| `TRIALING` | true |
| `PAST_DUE`, within 7 days of period end | true (Stripe is retrying) |
| `PAST_DUE`, more than 7 days after period end | false |
| `CANCELED`, `UNPAID`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `PAUSED` | false, even if `currentPeriodEnd` is in the future |

`canWatch`: `video.access === "free"` returns true for everyone who is signed in (the sign-in rule from Spec 4 is applied before this); any other value, including a missing or unknown one, returns `hasFullAccess(...)`.

## Server wrapper

Module: `src/lib/billing/subscription.ts` (`server-only`).

```ts
getSubscription(userId: string): Promise<SubscriptionFacts | null>   // one indexed read, cached for the request
requireVideoAccess(learnerId: string, video: { access: string }): Promise<{ ok: true } | { ok: false; reason: "locked" }>
```

When the rule says no because of the 7-day safety net alone, `requireVideoAccess` first re-syncs once from Stripe and checks again, so a missed webhook heals itself.

## Signed playback

Module: `src/lib/billing/playback.ts` (`server-only`).

```ts
signPlaybackTokens(video: { playbackId?: string; access: string; durationSeconds: number }, now?: Date):
  { playback: string; thumbnail: string; storyboard: string } | null
```

Returns `null` for free videos, for videos with no playback id or a sample id, and when the Mux signing settings are missing. For a full-access Mux video it returns three RS256 JWTs (header `kid` = `MUX_SIGNING_KEY_ID`; claims `sub` = playback id, `aud` = `v`, `t`, `s` respectively, `exp` = now + the longer of 3600 seconds and 2 × `durationSeconds`), signed with `MUX_SIGNING_PRIVATE_KEY` (base64-encoded PEM). It is only ever called from `WatchScreen` **after** `requireVideoAccess` succeeds, so there is no path from a locked learner to a token. The tokens go to `VideoPlayer` as a prop and are not stored or logged.

## Where it is called

| Place | Behaviour on `locked` |
|---|---|
| `WatchScreen` (before reading playback id, transcript, glossary, layers) | Render `LockedVideo` |
| Hours heartbeat action | Return a refusal; nothing is counted or written |
| Understanding answer action | Return a refusal; nothing is written |
| Library list, host page, Up next | Mark the card locked; never hide it |
| Pick up where you left off | Skip videos the learner can no longer watch |
| Player for a full-access video | Tokens signed only after the check passes; a locked learner gets none |
| Autoplay "next" | Skip locked videos |

## Test cases (`tests/unit/billing/access-rule.test.ts`)

free video with no subscription; full video with no subscription; full video with `ACTIVE`; `ACTIVE` with `cancelAtPeriodEnd` before the period end; `PAST_DUE` inside and outside the 7 days; `CANCELED` with a future period end; `UNPAID`; `TRIALING`; stale `ACTIVE`; unknown `access` value treated as full; boundary at exactly 7 days.
