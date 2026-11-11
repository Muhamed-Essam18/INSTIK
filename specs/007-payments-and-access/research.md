# Research: Payments and Access

Items marked **Verify** are Stripe details to confirm against the installed SDK's types and Stripe's current docs while implementing; the design does not depend on them being exactly as written.

## Verify outcomes (settled against stripe 23.1.0's types, 2026-11-09)

- **Period end**: on the subscription item (`items.data[].current_period_end`), not on the subscription. Implemented in `schemas.ts` and `status.ts`.
- **Invoice's subscription**: `invoice.parent.subscription_details.subscription` (string or object). Implemented in `schemas.ts`.
- **Portal cancel flow**: supported. `billingPortal.sessions.create({ flow_data: { type: "subscription_cancel", subscription_cancel: { subscription } } })`.
- **Webhook verification**: `Stripe.webhooks.constructEvent(payload, header, secret, tolerance, cryptoProvider, receivedAt)` is a static, key-free call; the last argument lets tests fix the clock.
- **Portal period-end scheduling: NOT possible for monthly to yearly.** The portal's `schedule_at_period_end` conditions are only `decreasing_item_amount` and `shortening_interval`, so a switch to a longer interval at a higher price cannot be deferred. Following the decision recorded in §10, plan changes are switched **off** in the portal (`subscription_update.enabled: false`) and no proration fallback is used. FR-031 therefore needs the follow-up in tasks.md (T074, an in-app switch with subscription schedules) before launch.
- **Not yet confirmed**: Mux token audiences (`v`, `t`, `s`) and that Mux checks the token on every request, from Mux's docs. The code follows what the plan states; confirm before launch (T072).

## 1. Stripe is the provider; test mode only until launch

- **Decision**: Use Stripe (Checkout, Customer Portal, Tax, webhooks). Keys are `sk_test_`/`pk_test_` style test-mode keys only. The environment parser accepts Stripe variables as optional, and refuses a key starting `sk_live_` unless `BILLING_LIVE=true` is also set. `docs/product.md` is updated to record Stripe as decided.
- **Rationale**: This is the requested direction and the stack's first-named option. A guard turns "test keys only until launch" from a habit into a rule that fails loudly. Optional variables keep `next build` and tests free of secrets, as in earlier specs.
- **Alternatives**: Paddle as merchant of record (would remove VAT work, but not the requested direction); trusting a convention with no guard (a pasted live key would silently charge real cards).

## 2. Billing is off until three things are true

- **Decision**: `billingReady()` is true only when the price config has real amounts, Stripe keys are present and the webhook secret is present. Otherwise "Get full access" keeps its Spec 6 behaviour and `/billing/*` routes redirect to pricing.
- **Rationale**: Prices are still placeholders (FR-019, FR-034). It lets all code ship and be reviewed before launch decisions are made, with nothing able to charge.
- **Alternatives**: A separate feature flag (a second thing to forget); building behind a branch (long-lived, hard to review).

## 3. One price config, materialised into Stripe by a script

- **Decision**: `src/lib/billing/plans.ts` holds currency, monthly amount and yearly amount in minor units (or `null` placeholders), the product name, and derived values: formatted label, per-period text, and yearly saving = `1 - yearly / (12 × monthly)`, rounded down to a whole percent. `scripts/stripe-setup.ts` creates one Stripe Product and, for each period, a recurring Price with a lookup key built from period, currency and amount (for example `instik_full_monthly_eur_900`), tax-inclusive, and moves the lookup key if the amount changed. Checkout looks the price up by key. `--check` compares config and Stripe and exits non-zero on drift. A unit test fails if any price string is typed outside the config.
- **Rationale**: The page and the charge can only disagree if someone edits Stripe by hand, and `--check` catches that. Using Stripe Prices (rather than inline `price_data`) lets the Customer Portal offer Monthly/Yearly switching, which only works with real Price objects.
- **Alternatives**: Price ids in env variables with amounts in the dashboard (two sources of truth, FR-032 fails); inline `price_data` per checkout (creates a new anonymous price each time and cannot be a portal switch target).
- **Open for the owner, not blocking**: currency (assumed EUR because of EU VAT), amounts, and whether prices are shown tax-inclusive. All three are config values. **Verify** the lookup-key transfer option when amounts change.

## 4. Checkout is a redirect route, started by a plain link

- **Decision**: The Full access button is an ordinary link to `/billing/start?period=monthly|yearly` (a Route Handler, `GET`). Signed out: redirect to onboarding with that URL as `returnTo`, so the learner finishes sign-up and lands back on it. Signed in: already subscribed goes to settings; otherwise create or reuse the Stripe customer, create a Checkout Session and redirect (303). The plan period is read from a zod-validated query value, never an amount or price id from the client.
- **Rationale**: Works without JavaScript, resumes the chosen period after sign-in (spec US2 scenario 2) and puts no secret or price logic in the browser. Creating a session is not a charge, so a link that creates one is safe; the learner still has to enter and confirm payment on Stripe's page. Plain `<a>` (not `next/link`) so it is never prefetched.
- **Alternatives**: A server action from a form (needs JavaScript state for the period and complicates the sign-in return); embedded Checkout or Elements (more PCI surface and client code, no benefit).
- **Details**: `mode: "subscription"`, `client_reference_id` = user id, `subscription_data.metadata.userId` = user id, `customer` = stored Stripe customer, `success_url` = `/billing/return?session_id={CHECKOUT_SESSION_ID}`, `cancel_url` = `/pricing?checkout=cancelled`. An idempotency key (user id, period, five-minute bucket) stops a double press creating two sessions; the unique `Subscription.userId` and the "already subscribed" check stop a second subscription (FR-018). Before creating a session, the route lists the customer's subscriptions in Stripe; if any is not ended (`active`, `trialing`, `past_due`, `unpaid`, `paused`, `incomplete`), it syncs that one and redirects to settings instead. This closes the window the five-minute idempotency key leaves (two tabs, a few minutes apart). A second active subscription that still appears later (for example two sessions completed at once) is recorded as `UNMATCHED` for review and never replaces the stored one (see §8).

## 5. Stripe Tax for EU VAT

- **Decision**: Checkout sets `automatic_tax: { enabled: true }`, `billing_address_collection: "required"` and `customer_update: { address: "auto" }`. Prices are tax-inclusive, so the amount on the pricing page is what the learner pays; the pricing page FAQ states "Prices include VAT where it applies" once real prices go live.
- **Rationale**: This is the requested direction. Stripe Tax needs the customer's location to calculate VAT, hence the required address. Tax-inclusive matches consumer pricing in the EU and the spec's "amount shown is the amount charged" (US2 scenario 6).
- **Launch tasks, not code**: turn on Stripe Tax in the dashboard, set the business origin address, register for the EU One-Stop Shop (or the countries needed) and choose a product tax code for the Full access product (a general electronically supplied service code is the likely fit; confirm with whoever handles accounts). Recorded in the quickstart launch checklist.
- **Alternatives**: Tax-exclusive prices (the total changes at checkout, which clashes with the pricing page); manual VAT tables (error-prone, not requested).

## 6. The access rule

- **Decision**: A pure function over the stored row and the current time. With `now`:
  - no row: no access
  - `ACTIVE` or `TRIALING`: access (this includes a subscription set to cancel at period end, which stays `ACTIVE` until the period ends; that is the "cancelled before period end" case)
  - `PAST_DUE`: access (Stripe is still retrying the renewal; spec assumption)
  - `CANCELED`, `UNPAID`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `PAUSED`: no access
  - safety net: for any status, if `now` is more than 7 days after `currentPeriodEnd`, no access, so a missed webhook cannot give access forever. When the safety net triggers on a learner who is not otherwise ended, the server re-syncs from Stripe once before locking (see 8).
  - a video is free only if its access value is exactly `"free"`; anything else needs the rule
- **Rationale**: Matches the spec: access ends when the subscription ends, never earlier, and failed renewals keep access while Stripe retries. In the Stripe dashboard, retries are set to end with the subscription cancelled, so `PAST_DUE` is bounded; the 7-day net backs that up in code. Cancelling at period end needs no special case because Stripe keeps the status `active` until the period is over, then sends `customer.subscription.deleted`.
- **Alternatives**: Treat `PAST_DUE` as locked (punishes a learner during a card hiccup; against the spec assumption); trust `currentPeriodEnd` alone (breaks during retries, when the date is already past).

## 7. Server-side gating of every protected video

- **Decision**: `requireVideoAccess(learnerId, video)` runs (a) in `WatchScreen` before the playback id, transcript view, glossary or layers are read, and (b) at the top of every server action that takes a video slug (the hours heartbeat and the understanding answer), returning a refusal instead of writing. Locked pages render `LockedVideo` with only the title, host, stage and length. Library and Up next receive an `accessible` flag computed on the server per learner; the static list is the fallback and carries no lock state.
- **Rationale**: Constitution X and spec FR-004. The page itself is the only thing that hands the playback id and transcript to the browser, so refusing there refuses the content. The proxy keeps its optimistic cookie check only; it makes no access decision.
- **Signed playback (decided)**: A Mux playback id alone can be played by anyone who has it, and the ids sit in `content/` files in the repo. So full-access videos use Mux **signed playback**: the asset's playback id has the signed policy, and the server signs a short-lived JWT (RS256, `node:crypto`, claims `sub` = playback id, `aud` = `v`, `exp`, header `kid` = signing key id) for the playback, thumbnail and storyboard audiences, **only after** the access check. `@mux/mux-player-react` takes them in its `tokens` prop. Free videos keep public playback ids and need no token. Expiry is the longer of one hour and twice the video's length, because Mux checks the token on each request, not only at the start (**Verify** in Mux docs). Signing keys (`MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`, base64 PEM) are optional settings; the sample clip and free videos need none. With the keys missing, a full-access Mux video cannot play and the player shows its normal "video unavailable" state; this is a launch checklist item, not a runtime fallback to public playback. Setting the signed policy on full-access assets is a content step at upload (see the launch checklist).
- **Alternatives**: Check in the proxy (it cannot read the database; the project already decided against this); hide with CSS or client state (not access control).

## 8. Webhook: verify, record, re-read, upsert

- **Decision**: `POST /api/stripe/webhook`:
  1. Read the raw body with `request.text()` and the `stripe-signature` header.
  2. Verify with the SDK's `webhooks.constructEvent` (HMAC check plus a five-minute timestamp tolerance). Missing header, bad signature or stale timestamp: respond `400`, do nothing else.
  3. Insert `StripeEvent(id)`. A unique conflict that is already processed: respond `200` (duplicate).
  4. For `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid` and `invoice.payment_failed`, take the subscription id and run `syncSubscription`: retrieve the subscription from Stripe, find the learner (by stored customer id, else `metadata.userId`), map it with `status.ts`, and update only if this fetch started no earlier than the row's `syncedAt`. Other event types are recorded as ignored and answered `200`.
  5. Match failure, a payload that does not parse, or a **second active subscription** for a learner who already has a stored, not-ended one: record the event as `UNMATCHED`, log it, and answer `200` (retrying would never help); nothing is granted or replaced. Every field used from the verified event and from the fetched subscription is parsed with zod first (constitution X); a parse failure takes this path.
  5b. **Which subscription owns the row**: the stored row is replaced by a *different* Stripe subscription only when the stored one has ended (`CANCELED`, `INCOMPLETE_EXPIRED`) and the new one was created at or after it (`stripeCreatedAt`). A late event for an older, ended subscription never overwrites a newer row. Within the same subscription id, the `syncedAt` guard applies.
  6. Any processing error: leave the event unprocessed and answer `500` so Stripe retries.
- **Rationale**: Retrying events are the norm; reading current state makes ordering irrelevant (SC-007). The `syncedAt` guard stops two overlapping handlers from writing an older fetch over a newer one. Returning `200` for unmatched events avoids endless retries while still leaving a record to review (FR-024).
- **Alternatives**: Apply each event's payload (needs ordering rules per event type); trust the event body for access (a replayed or forged body would change access).
- **Verify**: the exact field for the period end. In current Stripe API versions it sits on the subscription item (`items.data[0].current_period_end`), not on the subscription. `status.ts` reads it from the item and is covered by a test with a captured fixture.

## 9. Instant access on return

- **Decision**: `/billing/return?session_id=...` (signed-in only) retrieves the Checkout Session, confirms it belongs to this learner (client reference id or customer id), and if it has a subscription runs `syncSubscription` for it, then redirects to `/settings?billing=success`. If the payment is not yet complete, redirect to `/settings?billing=pending`; a small client notice calls `router.refresh()` every 2 seconds for up to 30 seconds and then says "This is taking a little longer than usual. You will have access as soon as it clears."
- **Rationale**: Access then depends on Stripe's answer, not on webhook timing or on the learner coming back at all (the webhook still does the job if they close the tab). Meets SC-002 and FR-025.
- **Alternatives**: Wait for the webhook only (race with the redirect, the main cause of "I paid and I'm still locked" reports).

## 10. Manage and cancel through the Customer Portal

- **Decision**: `/billing/portal` (signed-in `GET`) creates a portal session and redirects; `?flow=cancel` creates it with a cancel flow for the learner's subscription so the first screen is Stripe's cancellation confirmation. The portal configuration (made by the setup script) enables payment-method update, invoice history, cancel **at period end**, resume before the end, and switching between the two Prices; it turns off the cancellation survey and any retention offer. Return URL is `/settings`.
- **Rationale**: Settings → Cancel → Stripe's "Confirm" is two presses with the end date shown by Stripe (FR-028). Reusing the portal avoids building and securing billing screens (payment methods, invoices, tax IDs).
- **Alternatives**: Custom cancel button calling the API (we would own copy, edge cases and a second confirmation page, for no gain); portal only, no deep link (three or more presses).
- **Switching (decided)**: Monthly to Yearly and back takes effect at the end of the current paid period, with no proration. The setup script configures the portal's subscription update with `proration_behavior: "none"` and scheduled-at-period-end for both directions, and settings carry one sentence: "Changing between monthly and yearly takes effect when your current period ends."
- **Verify**: `flow_data` support for the cancel flow, and that the portal's period-end scheduling applies to an interval change in both directions (its documented conditions are per type of change). If it does not, do not fall back to proration: switch the portal off for plan changes and build an in-app switch with subscription schedules as a follow-up task, and tell the owner.

## 11. Settings plan section and return notices

- **Decision**: A server `PlanSection` on `/settings` renders from the stored row: Free (link to pricing); Full with period, price from the config, next renewal; Full ending ("Access until 14 March", with "Resume" via the portal); past due ("We couldn't take your last payment. Update your card", with the portal link); ended (Free and a link to pricing). A `BillingNotice` shows `?billing=success|pending` on settings and `?checkout=cancelled` on pricing (client component reading the query inside `Suspense`, so both pages stay static where they are today).
- **Rationale**: Calm, specific, no urgency, and the date wording comes from `currentPeriodEnd`. Local dates are formatted in the learner's stored time zone when set.
- **Alternatives**: A separate `/account/billing` page (extra route with no design); toasts (transient, and the brand avoids pop-ups).

## 12. Pricing page for signed-in states

- **Decision**: The Full access button area is a server `FullAccessSlot` behind `Suspense`. Fallback (and signed-out with billing off): the existing `StartCta`. Signed-out with billing on: link to `/billing/start?period=...`. Signed in without a subscription: same link. Subscribed: "You have Full access" with a link to settings. The slot's client child reads the period from a context provided by `PricingSwitch`, so the link always carries the selected period.
- **Rationale**: The page stays prerendered and identical to the design for the common signed-out visitor (FR-037). Context lets a server-rendered child react to a client toggle without lifting the whole page to the client.
- **Alternatives**: Make the page dynamic (slower, unneeded); send the period in a cookie (hidden state).

## 13. Testing approach

- **Decision**: Pure functions and an injected Stripe client and store keep tests fast and secret-free. Signature tests use the SDK's `webhooks.generateTestHeaderString` against a known secret, covering valid, tampered payload, wrong secret, missing header and stale timestamp. The sync tests use a fake that records upserts and covers duplicate, out-of-order (older fetch after newer), unmatched, deleted and resubscribe. A watch-gate test renders the screen with a locked state and asserts no playback id or transcript text appears in the output. Live behaviour is checked in the quickstart with Stripe test mode, test cards and `stripe listen`.
- **Rationale**: Matches how specs 4 to 6 split unit tests from live checks, and avoids mocking Stripe's network.
- **Alternatives**: Network mocks (brittle); testing only against Stripe (slow, needs secrets in CI).
