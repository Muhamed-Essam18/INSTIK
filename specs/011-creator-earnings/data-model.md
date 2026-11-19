# Data Model: Creator Statistics and Monthly Earnings

All amounts are integer cents with a `currency` (`"EUR"` for now). All instants are UTC in the database; month keys (`"2026-11"`) and
days are Europe/Warsaw unless noted. "Checked in code" means validated by zod or a pure rule, as elsewhere in the project.

## Changes to existing tables

| Table | Change | Notes |
|---|---|---|
| `User` | `manualAccessAt DateTime?` | Set while an owner's manual full-access grant is active; null otherwise. Read with the subscription by `getFullAccess`. |
| `User` | relations `accessEvents` ("GrantedTo"), `accessGiven` ("GrantedBy") | History of grants for an account and by an owner. |

`WatchSession`, `VideoProgress`, `ComprehensionAnswer`, `Subscription`, `Video` and `Host` are read, not changed.

## New tables

### CountedView

One learner's one video on one day that earned the creator a view. Never updated.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `userId` | String? | The learner; `onDelete: SetNull` so a deleted account keeps the creator's total (privacy assumption). |
| `videoId` | String | `Video.id` (no cascade; videos are soft-deleted). |
| `creatorId` | String? | The video's creator (`Host.userId`) at the time; `SetNull` if the account is removed. |
| `day` | Date | The learner's day (same as `WatchSession.day`); drives the once-a-day rule. |
| `countedAt` | DateTime | The instant of the heartbeat that crossed 30 seconds. |
| `monthKey` | String | Warsaw `YYYY-MM` of `countedAt`, set once. |
| `warsawDay` | Date | Warsaw calendar day of `countedAt`, set once; groups weeks. |

Unique: `(userId, videoId, day)`. Indexes: `(creatorId, monthKey)`, `(creatorId, warsawDay)`, `(videoId, monthKey)`. A trigger refuses UPDATE and DELETE, except the changes that `ON DELETE SET NULL` makes to `userId` and `creatorId`.

### MonthlyRevenue

The one revenue record per month, whatever its source.

| Field | Type | Notes |
|---|---|---|
| `month` | String @id | `YYYY-MM`. |
| `currency` | String | `"EUR"`. |
| `grossCents`, `vatCents`, `feesCents`, `refundsCents` | Int | Each 0 to 1,000,000,000 (checked in code); whole cents. |
| `source` | enum `RevenueSourceKind` | `MANUAL` now; `GATEWAY` later. |
| `version` | Int | Starts at 1; each save adds 1 and must match the version the editor loaded. |
| `updatedById` | String? | Owner who saved last. |
| `updatedAt` | DateTime | |

### RevenueChange (append-only)

`id`, `month`, the four cents values as saved, `version`, `byId`, `at`. A trigger refuses update and delete.

### RevenueAdjustment (append-only)

A correction entered in an open month for an earlier closed one.

| Field | Type | Notes |
|---|---|---|
| `id`, `month` | | The open month it is entered in. |
| `amountCents` | Int | Signed, not zero, within ±1,000,000,000. |
| `currency` | String | The month's currency (`"EUR"`), copied from that month's revenue record when the adjustment is entered. |
| `note` | String | 1 to 200 characters (checked in code): which month it corrects and why. |
| `byId`, `at` | | |

A trigger refuses update, delete and any insert for a closed month. A mistaken adjustment is cancelled by a new one with the opposite sign.

### EarningsMonth

| Field | Type | Notes |
|---|---|---|
| `month` | String @id | |
| `status` | enum `MonthStatus` | `OPEN` (row optional) or `CLOSED`. |
| `closedAt`, `closedById` | | Null while open. |
| `currency`, `grossCents`, `vatCents`, `feesCents`, `refundsCents`, `adjustmentsCents` | | Frozen copy of the figures at closing. |
| `netCents`, `poolCents`, `instikCents`, `totalViews` | Int | Frozen results. |

A trigger refuses any update once `status = CLOSED`.

### CreatorEarning (frozen at closing)

| Field | Type | Notes |
|---|---|---|
| `id`, `month` | | |
| `creatorId` | String? | `SetNull` if the account is removed. |
| `creatorName` | String | Snapshot at closing. |
| `views` | Int | The creator's counted views that month. |
| `earningsCents` | Int | Their share of the pool; the rows sum to `poolCents` when `totalViews > 0`. |
| `currency` | String | The month's currency, copied at closing. |

Unique `(month, creatorId)`. A trigger refuses update and delete.

### Payout (append-only)

| Field | Type | Notes |
|---|---|---|
| `id`, `month` | | |
| `creatorId` | String? | |
| `kind` | enum `PayoutKind` | `PAID` or `REVERSAL`. |
| `amountCents` | Int | Always positive; the amount of the closed earning, set by the service. |
| `currency` | String | Copied by the service from the closed month (`EarningsMonth.currency`), never from input; a reversal copies the currency of the record it reverses. |
| `reference` | String | 1 to 120 characters; the bank transfer reference, or the reason for a reversal. |
| `byId`, `at` | | The owner and the time. |
| `reversesId` | String? | For `REVERSAL`, the `PAID` row it cancels. |

A creator-month is **paid** when the sum of `PAID` minus the sum of `REVERSAL` equals its earnings, and **unpaid** otherwise. A trigger refuses update and delete.

### AccessGrantEvent (append-only)

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `userId` | String | The account that was given or lost access (`Cascade`). |
| `kind` | enum `GrantKind` | `GRANTED` or `REMOVED`. |
| `reason` | enum `GrantReason` | `TESTING`, `CREATOR`, `GIFT`, `OTHER`. |
| `note` | String? | Up to 200 characters. |
| `byId`, `at` | | The owner and the time. |

A trigger refuses update and delete. `User.manualAccessAt` is set on `GRANTED` and cleared on `REMOVED`, in the same transaction.

### ContentRequest

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | |
| `stage` | String | A stage slug from `taxonomy.ts` (checked in code). |
| `topic` | String | A topic slug from `taxonomy.ts` (checked in code). |
| `text` | String | 1 to 200 characters. |
| `status` | enum `RequestStatus` | `OPEN` or `CLOSED`. |
| `createdById`, `createdAt`, `updatedAt`, `closedAt` | | |

Index `(status, createdAt)`.

## Derived values (not stored while a month is open)

- **Net revenue** = `max(0, gross − vat − fees − refunds + adjustments)`.
- **Pool** = `floor(net × 80 / 100)`; **Instik** = `net − pool`.
- **Creator earnings** = largest-remainder split of the pool by counted views (see `research.md` §5).
- **Week buckets**: Monday-based Warsaw weeks over `CountedView.warsawDay`.

## State transitions

```text
Month:   OPEN --(owner closes; month has ended; revenue entered)--> CLOSED   (never reopened)
Revenue: editable while OPEN (version-checked); refused once CLOSED
Payout:  unpaid --(PAID)--> paid --(REVERSAL)--> unpaid --(PAID)--> paid      (append-only)
Grant:   none --(GRANTED)--> active --(REMOVED)--> none --(GRANTED)--> active (append-only)
Request: OPEN --(close)--> CLOSED
```

## Validation rules

- Month keys must match `^\d{4}-(0[1-9]|1[0-2])$`; a month cannot be closed before its last Warsaw instant has passed.
- Revenue figures: integers, 0 to 1,000,000,000 cents (the form accepts euros with up to two decimals and converts without floating point).
- Adjustments: non-zero integer cents, note required, only for the current open month.
- A payout reference is required; amounts and currencies are never accepted from the browser. Every stored amount (revenue, adjustment, earning, payout) has a currency next to it.
- Grant email must match an existing account; the reason is one of the four values.
