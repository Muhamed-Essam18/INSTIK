# Data Model: Payments and Access

Learner data lives in PostgreSQL through Prisma (constitution VIII, X). Nothing here goes in `content/`. Each video's free/full value stays in its content file (`access`), already validated at build by the video schema.

## Changes to `User`

| Field | Type | Notes |
|---|---|---|
| `stripeCustomerId` | `String?` `@unique` | The Stripe customer for this learner; set when they first start checkout; never exposed to the client |

New relation: `subscription Subscription?`.

## `Subscription` (new)

One row per learner. It mirrors the learner's current Stripe subscription and is the only basis for access decisions (FR-023). A learner who subscribes again after an ended subscription has this row replaced by the new subscription.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` `@id @default(cuid())` | |
| `userId` | `String` `@unique` | One subscription row per learner; `onDelete: Cascade` |
| `stripeSubscriptionId` | `String` `@unique` | Stripe `sub_...` id |
| `status` | `SubscriptionStatus` | Mirrors Stripe; see below |
| `plan` | `BillingPlan` | `MONTHLY` or `YEARLY` |
| `currentPeriodEnd` | `DateTime` | End of the paid period (from the subscription item) |
| `cancelAtPeriodEnd` | `Boolean` | True after the learner cancels; status stays `ACTIVE` until the end |
| `stripeCreatedAt` | `DateTime` | When Stripe created that subscription; decides whether a different subscription may replace an ended row |
| `syncedAt` | `DateTime` | When the Stripe read that produced this row started; a later write is applied only if its read started no earlier |
| `createdAt` / `updatedAt` | `DateTime` | |

Index: `userId` (unique already covers it).

### `SubscriptionStatus` enum

`INCOMPLETE`, `INCOMPLETE_EXPIRED`, `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `UNPAID`, `PAUSED` (Stripe's set, upper-cased). An unrecognised Stripe status is stored as `INCOMPLETE_EXPIRED`-equivalent no-access and logged, never as an access-granting value.

### `BillingPlan` enum

`MONTHLY`, `YEARLY`. Derived from the subscription item's price lookup key or recurring interval. Only one paid plan exists (Full access); the enum is the period.

### Access mapping (see [contracts/access-rule.md](contracts/access-rule.md))

| Status | Access |
|---|---|
| `ACTIVE`, `TRIALING` | Yes (including when `cancelAtPeriodEnd` is true and the period has not ended) |
| `PAST_DUE` | Yes while Stripe retries |
| `CANCELED`, `UNPAID`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `PAUSED` | No |
| any, more than 7 days after `currentPeriodEnd` | No (safety net) |

### State transitions

```
(no row) --checkout paid--> ACTIVE
ACTIVE --learner cancels--> ACTIVE + cancelAtPeriodEnd   (access continues)
ACTIVE + cancelAtPeriodEnd --resume before end--> ACTIVE
ACTIVE + cancelAtPeriodEnd --period ends--> CANCELED     (access ends)
ACTIVE --renewal fails--> PAST_DUE --retry succeeds--> ACTIVE
PAST_DUE --retries exhausted--> CANCELED (or UNPAID)     (access ends)
CANCELED --subscribes again--> row replaced, ACTIVE
```

Hours, level, rhythm, preferences and answers are separate tables and are never touched by any of these transitions (FR-006).

## `StripeEvent` (new)

A record of each webhook delivery, for idempotency and review. It holds no learner content and no payment data.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` `@id` | Stripe event id (`evt_...`); the primary key is the idempotency guard |
| `type` | `String` | e.g. `customer.subscription.updated` |
| `outcome` | `StripeEventOutcome` | `RECEIVED`, `PROCESSED`, `IGNORED`, `UNMATCHED` |
| `stripeObjectId` | `String?` | Subscription or customer id the event refers to, for review of unmatched events |
| `receivedAt` | `DateTime @default(now())` | |
| `processedAt` | `DateTime?` | Set when handled |

Index: `(outcome, receivedAt)` so unmatched events are easy to list. Rows older than 90 days may be deleted (retention is a launch task; nothing depends on old rows because processing is idempotent).

## Validation rules

- A `Subscription` is written only by `syncSubscription`, never from a client request, and only after a Stripe read.
- Every field read from a Stripe event or subscription is parsed with zod first; a parse failure records the event as `UNMATCHED` and changes nothing.
- A different `stripeSubscriptionId` replaces the stored row only if the stored status is `CANCELED` or `INCOMPLETE_EXPIRED` and the new `stripeCreatedAt` is the same or later. A second active subscription while the stored one has not ended is recorded as `UNMATCHED` (outcome detail in `stripeObjectId`) and never replaces it.
- `userId` is resolved from the stored `stripeCustomerId`, falling back to `metadata.userId` set when the Checkout Session was created. If neither matches a user, nothing is written and the event is `UNMATCHED` (FR-024).
- `currentPeriodEnd` must be a valid date; a subscription with none is stored as no-access.
- The `period` accepted by `/billing/start` is one of `monthly` or `yearly` (zod); amounts and price ids never come from the client.

## Not stored

Card numbers, payment methods, invoices and tax ids (Stripe holds them; the learner reaches them through the portal). Prices (they are in the config, see [contracts/price-config.md](contracts/price-config.md)).
