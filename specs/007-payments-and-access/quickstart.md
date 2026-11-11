# Quickstart: validating Payments and Access

## Prerequisites

- `npm install` (adds `stripe`), and a development database in `.env.local`.
- `npm run db:migrate` to add `Subscription`, `StripeEvent` and `User.stripeCustomerId`.
- A Stripe account in **test mode** with Stripe Tax switched on (set the origin address in the dashboard). Use test keys only.
- The [Stripe CLI](https://docs.stripe.com/stripe-cli) logged in to the same test account.
- `.env.local` additions (see `.env.example`): `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_WEBHOOK_SECRET` (printed by `stripe listen`). `BILLING_LIVE` stays unset.
- In `src/lib/billing/plans.ts`, set test amounts (for example monthly `900`, yearly `8100`). Then `node scripts/stripe-setup.ts`, and `node scripts/stripe-setup.ts --check` should print "no drift".

## Automated checks

```
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` must pass with no `.env.local` and no Stripe keys.

## Manual scenarios (`npm run dev`, with `stripe listen --forward-to localhost:3000/api/stripe/webhook`)

1. **Free learner, locked state** (US1): sign in as a learner with no subscription. In the library, free cards have no marker and full-access cards show "Full access" with title, host and length intact. Open a free video: it plays. Open a full-access video: the calm panel shows with "See Full access" and "Back to the library"; no modal, no overlay. View the page source and the network tab: no playback id and no transcript text for that video. Keyboard: the link is reachable and focus is visible; a screen reader reads the reason.
2. **Signed-out visitor** (US1): open a video link signed out. The Spec 4 account prompt shows, not the locked panel.
3. **Subscribe** (US2): on `/pricing` choose Yearly, press "Get full access". Checkout opens for the yearly price with VAT shown for an EU address. Pay with `4242 4242 4242 4242`. You land on settings with "You have Full access". The previously locked video now plays. It should take under 10 seconds from return.
4. **Signed-out purchase** (US2): sign out, choose Yearly on `/pricing`, press the button. After sign-up you land on checkout for Yearly.
5. **Cancelled and failed payment** (US2): start checkout and go back: `/pricing` shows "No payment was taken". Use test card `4000 0000 0000 0002` (declined): nothing changes, you stay on Free.
6. **Already subscribed** (US2): open `/pricing`: the Full access card says you have it and links to settings; `/billing/start?period=monthly` redirects to settings.
7. **Access follows the webhook** (US3): in the Stripe dashboard (test), cancel the subscription immediately. Within seconds the next page load locks full-access videos and free videos still play. Hours, roadmap and rhythm are unchanged. Re-send the same event from the dashboard or `stripe events resend`; nothing changes and the event shows as a duplicate.
8. **Out of order** (US3): `stripe trigger customer.subscription.updated` then resend an older event; the stored status equals Stripe's current status.
9. **Bad signature** (US3): `curl -X POST localhost:3000/api/stripe/webhook -d '{}'` returns 400 and writes nothing.
10. **Cancel from settings** (US4): on settings press "Cancel subscription". Stripe's confirmation shows the end date. Confirm. Settings now say "Full access until <date>" with "Resume"; videos still play; hours unchanged. Press Resume and confirm the subscription is active with no gap. Use a test clock (`stripe test_helpers`) to advance past the period end after cancelling again: access ends and settings say you are on Free.
11. **Past due** (US3, US4): use a test clock with card `4000 0000 0000 0341` (attaches, then fails on renewal). After the renewal fails settings show the past-due message; videos still play; after Stripe's retries end, access ends.
12. **One price config** (US5): change `amounts.monthly` in `plans.ts`; the pricing page and settings show the new price; `stripe-setup.ts --check` reports drift; running the script creates the new Price and the next checkout uses it. Set both amounts back to `null`: the page shows `[PRICE]` and `[Save X%]`, and the button goes to onboarding again.
13. **Test-mode guard**: set `STRIPE_SECRET_KEY=sk_live_x` without `BILLING_LIVE`; startup fails with a message naming the variable (not its value).
14. **Signed playback** (US1, US3): with `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY` set and a full-access test asset uploaded with the signed policy, a subscribed learner's player has `tokens` and plays; open the playback URL without a token in a private window and Mux refuses it (403); a learner without access receives no token (view source and network tab). A free video plays with its public id and no token.
15. **Return address and double purchase** (US2): signed out, choose Yearly and press the button; after sign-up you land on `/billing/start?period=yearly` and then Checkout (not the library). With an active subscription, open `/billing/start?period=monthly` in a second tab: it goes to settings and no new session is created.
16. **Host page and pick-up** (US1): as a learner without access, the host page shows the "Full access" marker on locked videos; after letting a subscription end, "Pick up where you left off" shows the most recent video you can still watch, or nothing.
17. **Accessibility and design**: the pricing page for a signed-out visitor matches `docs/design/Pricing.dc.html` at 375, 768 and 1440 px; new states keep 44px targets and contrast of at least 4.5:1.

## Launch checklist (not part of this feature's code)

- Decide real amounts and currency; set them in `plans.ts`; add "Prices include VAT where it applies" to the pricing FAQ.
- Stripe Tax: origin address, EU One-Stop Shop registration, product tax code confirmed.
- Stripe dashboard: retry schedule ends with the subscription cancelled; Customer Portal configuration created by the script and reviewed; webhook endpoint added for the production URL.
- Video host: create the Mux signing key and set `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY`; upload every full-access video with the **signed** playback policy and every free video with the public policy; confirm no full-access playback id in `content/` is public.
- Swap to live keys and set `BILLING_LIVE=true` only at launch; re-run `stripe-setup.ts --check` against live.
- Review and delete old `StripeEvent` rows on a schedule (90 days).
