# Contract: Stripe webhook

Route: `POST /api/stripe/webhook` (`src/app/api/stripe/webhook/route.ts`, Node runtime). Called only by Stripe. Registered in the Stripe dashboard (test mode) for the events below; locally forwarded with `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Request

- Body: the raw event JSON, read with `request.text()` (never `request.json()` before verification).
- Header: `stripe-signature`.
- Secret: `STRIPE_WEBHOOK_SECRET` (server only).

## Verification (`src/lib/billing/webhook.ts`)

```ts
verifyEvent(rawBody: string, signature: string | null, secret: string, now?: Date): Stripe.Event
// throws WebhookVerificationError("missing-signature" | "bad-signature" | "stale-timestamp" | "bad-payload")
```

Uses the SDK's `webhooks.constructEvent` (HMAC-SHA256 over `timestamp.payload`, constant-time compare, five-minute tolerance). After it passes, only the fields the handler needs are read, each parsed with zod.

## Responses

| Case | Status | Writes |
|---|---|---|
| Billing not configured (no secret) | 503 | none |
| Missing or bad signature, stale timestamp, unreadable body | 400 | none |
| Duplicate of an event already `PROCESSED` | 200 | none |
| Event type we do not use | 200 | `StripeEvent` as `IGNORED` |
| Matches no learner | 200 | `StripeEvent` as `UNMATCHED`; no `Subscription` change |
| Handled | 200 | `Subscription` upsert; `StripeEvent` as `PROCESSED` |
| Error while processing (Stripe unreachable, database error) | 500 | event left `RECEIVED` so Stripe retries |

The body of every response is empty or a short fixed string; it never echoes input, the secret or internal errors.

## Events handled

`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Each yields a subscription id (from the object, or `invoice.parent.subscription_details.subscription` for invoices; **verify** the field name against the SDK types) which is passed to `syncSubscription`.

## `syncSubscription(subscriptionId, deps)` (`src/lib/billing/sync.ts`)

```ts
deps = { stripe: { retrieveSubscription(id) }, store: { findUserIdByCustomer, findUserExists, upsertIfNewer, recordEvent } , now: () => Date }
```

1. `startedAt = now()`; retrieve the subscription from Stripe.
2. Resolve the learner: `findUserIdByCustomer(customerId)`, else `metadata.userId` if that user exists, else return `unmatched`.
3. Map with `status.ts`: status, plan (from the price lookup key, else the recurring interval), `currentPeriodEnd` (from the subscription item), `cancelAtPeriodEnd`.
4. `upsertIfNewer`:
   - no stored row: insert.
   - same `stripeSubscriptionId`: update only where `syncedAt <= startedAt`, setting `syncedAt = startedAt`.
   - different `stripeSubscriptionId`: replace only if the stored status is `CANCELED` or `INCOMPLETE_EXPIRED` and the new subscription's `stripeCreatedAt` is the same or later; if the stored one has not ended and the new one is active (`ACTIVE`, `TRIALING`, `PAST_DUE`), write nothing and return `duplicate-active`; otherwise (an older or ended subscription) write nothing and return `stale`.
5. Return `applied`, `stale` (an older read lost; nothing written), `duplicate-active` (recorded as `UNMATCHED` with the subscription id in `stripeObjectId`, logged) or `unmatched`.

Every field read from the event and from the fetched subscription (ids, status, items, period end, cancel flag, created, metadata) is parsed with a zod schema first (`src/lib/billing/schemas.ts`). A payload that fails to parse is logged (type and event id only, never the body) and recorded as `UNMATCHED`; the route answers 200.

Safe to run any number of times in any order.

## Test cases

`tests/unit/billing/webhook-signature.test.ts`: valid signature; payload changed after signing; signed with another secret; header missing; header malformed; timestamp older than tolerance; empty secret refused.

`tests/unit/billing/sync.test.ts`: same event delivered five times gives one row and one outcome; an older read arriving after a newer one writes nothing; `deleted` ends access; `updated` with `cancel_at_period_end` keeps access; unmatched customer records `UNMATCHED` and writes no subscription; resubscribe after ended replaces the row; unknown Stripe status stores no access; Stripe error propagates (so the route answers 500); a payload missing a required field (no customer, no items, bad status type) is recorded `UNMATCHED` and changes nothing; a late event for an older ended subscription arriving after a resubscribe does not overwrite the newer row; a second active subscription while the stored one is active is recorded `UNMATCHED` and the stored row is unchanged; a newer subscription replaces an ended row.
