# Contract: billing routes and pages

All routes are Route Handlers in `src/app/billing/**` and use the Data Access Layer (`getLearner`) for the session. None returns HTML or JSON with Stripe objects; each redirects with `303`. Path helpers are added to `src/lib/routes.ts` (`billingStartPath(period)`, `billingPortalPath(flow?)`, `billingReturnPath`).

When `billingReady()` is false (placeholder prices, or missing Stripe settings) every `/billing/*` route redirects to `/pricing`.

## `GET /billing/start?period=monthly|yearly`

| Case | Result |
|---|---|
| `period` missing or not one of the two | redirect `/pricing` |
| Signed out | redirect `/onboarding?returnTo=/billing/start?period=<period>` (the learner finishes sign-up and returns here) |
| Signed in, already has access (`hasFullAccess`) | redirect `/settings` |
| Signed in, Stripe lists a subscription for the customer that has not ended (`active`, `trialing`, `past_due`, `unpaid`, `paused`, `incomplete`) | sync it, then redirect `/settings` (no second session is created) |
| Signed in, otherwise | find or create the Stripe customer (idempotent, stored on `User.stripeCustomerId`), create a Checkout Session, redirect to its URL |
| Stripe error | redirect `/pricing?checkout=unavailable` (calm "try again in a moment") |

Checkout Session: `mode: "subscription"`; the single line item is the Price found by its lookup key for the period; `client_reference_id` and `subscription_data.metadata.userId` are the learner id; `automatic_tax.enabled`; `billing_address_collection: "required"`; `customer_update.address: "auto"`; `success_url` = `<site>/billing/return?session_id={CHECKOUT_SESSION_ID}`; `cancel_url` = `<site>/pricing?checkout=cancelled`; idempotency key from learner, period and a five-minute bucket.

**Return address**: `src/lib/auth/return-to.ts` allows `/billing/start?period=monthly|yearly` and `/pricing` (the query pattern already allows `=` and `&`; the shape list gains `/billing/start` with the `period` query only, and `/pricing`). Nothing else under `/billing` or `/api` is allowed as a return address.

## `GET /billing/return?session_id=cs_...`

Signed in only (signed out goes to sign-in with `/settings` as the return address, because this URL is not an allowed return address).

1. Validate `session_id` shape (zod).
2. Retrieve the Checkout Session; refuse (redirect `/pricing`) unless its `client_reference_id` or customer is this learner's.
3. If it has a subscription, run `syncSubscription` for it.
4. Redirect: paid and now active → `/settings?billing=success`; payment still processing → `/settings?billing=pending`; not completed → `/pricing?checkout=cancelled`.

## `GET /billing/portal[?flow=cancel]`

Signed in only (signed out goes to sign-in with `/settings` as the return address). Needs a stored Stripe customer, otherwise redirect `/pricing`.

| Case | Result |
|---|---|
| No `flow` | create a portal session, redirect to it (update card, invoices, resume, switch period) |
| `flow=cancel` and the learner has a subscription | portal session with a cancel flow for that subscription, so its first screen is the cancellation confirmation |
| Stripe error | redirect `/settings?billing=unavailable` |

Return URL: `<site>/settings`. Cancellation is at period end; no survey and no retention offer (portal configuration made by `scripts/stripe-setup.ts`).

## Pages changed

| Page | Change |
|---|---|
| `/pricing` | Full access button area becomes a session-aware slot; prices from the config; `?checkout=cancelled|unavailable` notice. Signed-out and billing-off rendering is identical to Spec 6 |
| `/settings` | New plan section; `?billing=success|pending|unavailable` notice (pending refreshes itself) |
| `/learn/[language]/watch/[video]` | Locked panel when the learner has no access |
| `/learn/[language]` (library), host page, Up next | Locked marker on full-access cards for learners without access |
| Library "Pick up where you left off" | Skips videos the learner can no longer watch; shows the most recent one they can |
| Player (full-access video, learner with access) | Playback tokens signed on the server are passed to the player; none are created or sent otherwise |

## Copy (draft, brand voice)

| Where | Text |
|---|---|
| Locked card marker | "Full access" |
| Locked panel | "This one is part of Full access." / "Free videos are still here for you, and your hours stay exactly as they are." / link "See Full access" / link "Back to the library" |
| Success | "You have Full access. Enjoy every video." |
| Pending | "Setting things up. This usually takes a few seconds." |
| Pending too long | "This is taking a little longer than usual. You will have access as soon as the payment clears." |
| Checkout cancelled | "No payment was taken. You can try again whenever you like." |
| Stripe unavailable | "We couldn't reach the payment page. Please try again in a moment." |
| Ending | "Full access until 14 March. Your hours stay with you." / "Resume" |
| Plan switch (settings, under the plan details) | "Changing between monthly and yearly takes effect when your current period ends." |
| Past due | "We couldn't take your last payment. You still have access while we try again. You can update your card any time." |
| Ended | "You're on Free. Your hours and roadmap are exactly as you left them." / "See Full access" |

No countdowns, no urgency words, no guilt.
