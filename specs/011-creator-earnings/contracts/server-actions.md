# Contract: Server actions and service functions

Every action is a `"use server"` function that first calls `requireOwner` or `requireCreator` (never trusts an actor, role or user id from its input),
parses its input with zod, calls the service, and returns a result the screen can show. Services take the acting user and refuse anyone else with
`ForbiddenError` before touching the store. Results use short, calm messages in `messages.ts` (no "failed", "invalid" or shaming words).

## Earnings (owner)

| Function | Input | Result | Refusals |
|---|---|---|---|
| `getStatement(actor, month)` | month key | revenue figures, adjustments, net, pool, Instik, total views, creator lines, payout state (the latest 100 payout records), status (estimated or final); every amount comes with its currency | not owner |
| `listMonths(actor)` | none | months with status, newest first, capped at 24 | not owner |
| `saveRevenue(actor, input)` | month, euros for gross, VAT, fees, refunds, `expectedVersion` | saved figures + new version | not owner, closed month, not whole cents, negative, out of range, stale version ("Figures changed. Reload to see them.") |
| `addAdjustment(actor, input)` | amount (euros, signed), note | updated statement | not owner, month closed, zero, no note, note too long |
| `closeMonth(actor, month)` | month key | final statement; second call returns the same result with `alreadyClosed: true` | not owner, month not ended, no revenue |
| `markPaid(actor, input)` | month, creator id, reference (amount and currency are copied from the closed month, never from input) | payout record with amount and currency | not owner, month open, creator has no earnings, already paid, no reference |
| `reversePayout(actor, input)` | payout id, reason | reversal record | not owner, not a paid record, already reversed |

## Creator

| Function | Input | Result | Notes |
|---|---|---|---|
| `getDashboard(actor)` | none (month is now, Warsaw) | the dashboard data in the design | Takes only the actor; the creator id is `actor.id`. Refuses learners and signed-out visitors; an owner who is also a creator gets their own creator dashboard like any creator. Cached per creator through the injected `readDashboard` dependency (the `use cache` reader, wired only in `instance.ts`). |

A creator never passes a creator id, month or any filter that could reach another creator's rows.

## Access grants (owner)

| Function | Input | Result | Refusals |
|---|---|---|---|
| `grantAccess(actor, input)` | email, reason, note? | event, account now has full access | not owner, no such account, already granted |
| `removeAccess(actor, input)` | email or user id, note? | event, flag cleared | not owner, no active grant |
| `listGrants(actor)` | none | active grants then recent events, capped at 100 | not owner |

## Content requests

| Function | Input | Who |
|---|---|---|
| `listOpenRequests(actor)` | none | creator or owner (open only, newest first, at most 20) |
| `listAllRequests(actor)` | none | owner (open and closed, capped at 100) |
| `createRequest`, `editRequest`, `closeRequest` | stage, topic, text / id | owner only |

## Cache invalidation

`saveRevenue`, `addAdjustment`, `closeMonth`, `markPaid`, `reversePayout` and the request actions call `updateTag` for `creator-stats:<id>` (each
affected creator) or all creators' tags. Reads never invalidate.

## Heartbeat (not a new action)

1. Inside the heartbeat transaction, `recordHeartbeat` only notes crossings: for each day part it knows `secondsBefore` and `secondsAfter` (the row's
   seconds after the upsert minus the part just added, and the row's seconds after it). A day part has crossed when `secondsBefore < 30 <= secondsAfter`.
   No counting query runs in that transaction.
2. **After the transaction has committed**, `recordHeartbeat` calls `recordCountedViewIfCrossed(crossings, nowMs)` (in `src/lib/earnings/record-view.ts`)
   with the crossings it noted. A heartbeat that rolled back or was rejected counts nothing.
3. `recordCountedViewIfCrossed` runs in its own `try/catch`: a failure is logged (`console.error` with the learner id removed) and swallowed. It never
   changes the heartbeat's result, never throws into the learner's session, and never touches Hours; a lost view is accepted over a lost hour.
4. Inserts use `createMany({ skipDuplicates: true })`, so a repeat or a second device is harmless.
