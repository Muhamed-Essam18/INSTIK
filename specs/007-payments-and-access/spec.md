# Feature Specification: Payments and Access

**Feature Branch**: `007-payments-and-access`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Spec 7: payments and access. Read docs/product.md and docs/design/Pricing.dc.html first. Each video is free or full access (from its content file). Free learners can watch free videos; full-access videos show a calm locked state on cards and the player with a link to pricing, never a pop-up wall. Learners can subscribe monthly or yearly from the pricing page and manage or cancel their subscription from account settings. Cancelling keeps access until the end of the paid period, and hours are never lost. Access updates as soon as payment succeeds or a subscription ends. Prices come from one config, matching the pricing page. Out of scope: discounts, gift cards, team plans."

## Clarifications

### Session 2026-11-09

- Q: Do signed-out visitors see the locked state on full-access videos? → A: No. Spec 4 already requires an account to watch any video, so signed-out visitors see its account prompt; the locked state is for signed-in learners without a subscription (resolved from Spec 4, no new decision).
- Q: How are full-access videos protected from someone who has the video's address but no subscription? → A: Full-access videos play only with a short-lived token issued by the server to learners with access; free videos stay public.
- Q: When does a switch between Monthly and Yearly take effect? → A: At the end of the current paid period, with no proration; settings say so in one sentence.
- Q: What if a learner ends up with two active subscriptions? → A: Checkout is not offered while one exists, and a second active subscription found later is recorded for review and never replaces the first.
- Q: What does "Pick up where you left off" do after access is lost? → A: It skips videos the learner can no longer watch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Free learners watch free videos and see full-access videos calmly locked (Priority: P1)

A learner without a subscription browses the library. Free videos play as normal. Full-access videos are clearly marked as full access and show a quiet locked state on the card. If the learner opens one, the player page shows the same calm locked state with a short, kind explanation and a link to the pricing page. Nothing pops up, nothing blocks the page, and the learner can go straight back to the library or to a free video.

**Why this priority**: This is the access rule itself. Every other story depends on it, and it protects the free experience the brand promises.

**Independent Test**: Sign in as a learner with no subscription. Confirm free videos play and full-access videos show the locked state on the library card and on the player page with a link to pricing, with no modal, overlay wall or interruption.

**Acceptance Scenarios**:

1. **Given** a learner with no subscription, **When** they open a video marked free, **Then** it plays with its transcript as usual.
2. **Given** a learner with no subscription, **When** they view the library, **Then** each full-access video card shows a calm locked marker and still shows its title, host, stage and duration; free video cards show no marker.
3. **Given** a learner with no subscription, **When** they open a full-access video, **Then** the page shows the video's title, host and a calm locked message with a link to pricing, the video does not play, and no pop-up, modal or blocking overlay appears.
4. **Given** the locked player page, **When** the learner follows the pricing link, **Then** they reach the pricing page; **When** they use the back control, **Then** they return to where they were.
5. **Given** a signed-out visitor who opens any video link, free or full access, **Then** they see the existing account prompt from Spec 4 (title, host, sign in or join) and not the locked state, because the account rule applies before the access rule; once signed in without a subscription, a full-access video shows the locked state.
6. **Given** a learner with an active subscription, **When** they view the library or open any video, **Then** no locked markers appear and every video plays.

---

### User Story 2 - Subscribe monthly or yearly from the pricing page (Priority: P1)

A learner decides to subscribe. On the pricing page they choose Monthly or Yearly, press "Get full access" and complete payment. When payment succeeds they come back to Instik and can watch full-access videos straight away, with a kind confirmation.

**Why this priority**: This is how Instik earns revenue and how learners unlock the full library.

**Independent Test**: As a signed-in free learner, choose Yearly on the pricing page, press "Get full access", complete a test payment, and confirm the learner lands back in Instik with a confirmation and a previously locked video now plays.

**Acceptance Scenarios**:

1. **Given** the pricing page, **When** the learner chooses Monthly or Yearly and presses "Get full access", **Then** they are taken to secure payment for the plan and period they chose, at the price shown on the page.
2. **Given** a signed-out visitor, **When** they press "Get full access", **Then** they are asked to sign in or create an account first and, once signed in, continue to payment for the period they had chosen.
3. **Given** a successful payment, **When** the learner returns to Instik, **Then** they see a short, warm confirmation, and full-access videos play without further steps.
4. **Given** a cancelled or failed payment, **When** the learner returns, **Then** they see a calm message, nothing is charged, they remain on Free, and they can try again.
5. **Given** a learner who already has an active subscription, **When** they open the pricing page, **Then** the Full access card shows that they already have it and points to account settings instead of offering a second purchase.
6. **Given** the pricing page, **When** it shows prices, **Then** they come from the same price configuration used for payment, so the amount shown is the amount charged.

---

### User Story 3 - Access updates as soon as payment succeeds or a subscription ends (Priority: P1)

Access follows the subscription without the learner doing anything. When a payment succeeds, full-access videos unlock within moments. When a subscription ends (the paid period runs out after cancelling, or renewal payment ultimately fails), full-access videos lock again, and free videos and all of the learner's progress remain.

**Why this priority**: Wrong access in either direction is costly: a paying learner still locked out, or a lapsed learner who keeps access.

**Independent Test**: Complete a test payment and check a locked video unlocks without signing out or reloading more than once. End a test subscription and check full-access videos lock while hours, roadmap and rhythm are unchanged.

**Acceptance Scenarios**:

1. **Given** a learner on the locked player page, **When** their payment succeeds, **Then** the video becomes watchable within a few seconds of their return, without signing out.
2. **Given** a subscription whose paid period has ended, **When** the learner next opens the library or a video, **Then** full-access videos show the locked state and free videos still play.
3. **Given** a renewal payment that fails, **When** the payment provider gives up retrying and ends the subscription, **Then** access ends at that moment and not before.
4. **Given** the same notification of payment or subscription change arrives more than once or out of order, **When** it is processed, **Then** the learner's access ends up correct and nothing is applied twice.
5. **Given** a learner is part-way through a full-access video when their subscription ends, **When** they next load or move to another video, **Then** the locked state shows kindly; hours already counted are kept.

---

### User Story 4 - Manage or cancel from account settings, keeping access and hours (Priority: P2)

A subscribed learner opens account settings and sees their plan, period, price, next renewal date and a link to payment details. They can change the payment method, see invoices, and cancel. Cancelling takes two presses, is kindly worded and says plainly that access continues until the end of the paid period. After cancelling, settings show the end date and offer to resume. Hours, roadmap and rhythm are never touched.

**Why this priority**: Honest, easy cancellation is a brand promise ("Cancel any time", "Your hours stay with you"), but it only matters once learners can subscribe.

**Independent Test**: As a subscribed learner, open settings, cancel, and confirm the page says access lasts until a named date, videos still play until then, hours are unchanged, and resuming before that date restores the subscription.

**Acceptance Scenarios**:

1. **Given** a subscribed learner, **When** they open account settings, **Then** they see their plan, billing period, price and next renewal date, with links to manage payment details and see invoices.
2. **Given** a subscribed learner, **When** they choose to cancel, **Then** they see one plain confirmation step stating the date access continues until, and the cancellation completes after one further press, with no dark patterns, retention offers or shaming copy.
3. **Given** a cancelled subscription still within its paid period, **When** the learner watches full-access videos, **Then** they play as normal, and settings show "Access until [date]" and a way to resume.
4. **Given** a cancelled subscription, **When** the learner resumes before the end date, **Then** the subscription continues with no gap and no second charge for the current period.
5. **Given** a subscription that has ended, **When** the learner opens settings, **Then** they see that they are on Free and a link to pricing; their total hours, roadmap position and rhythm are exactly as before.
6. **Given** a learner who never subscribed, **When** they open account settings, **Then** the plan section says they are on Free and links to pricing.

---

### User Story 5 - One price configuration drives everything (Priority: P2)

Prices, billing periods and the yearly saving are defined once. The pricing page, the checkout the learner is sent to, account settings and any other place that mentions a price all read from that single definition. Changing a price in one place updates all of them. While prices are undecided, the configuration holds clearly marked placeholders that match what the pricing page shows today.

**Why this priority**: Prevents the page and the charge from disagreeing, and lets the team set real prices later without hunting through screens.

**Independent Test**: Change a price value in the configuration and confirm the pricing page and settings show the new value and that checkout would charge it.

**Acceptance Scenarios**:

1. **Given** the price configuration, **When** its monthly or yearly amount changes, **Then** the pricing page, account settings and checkout all show or use the new amount with no other edit.
2. **Given** prices are still placeholders, **When** the pricing page loads, **Then** it shows the same placeholder text as the approved design (for example "[PRICE]" and "[Save X%]"), and payment is not offered until real amounts are configured.
3. **Given** real amounts are configured, **When** the pricing page loads, **Then** it shows the real monthly and yearly amounts, and the yearly saving is calculated from them rather than typed in separately.

---

### Edge Cases

- A learner presses "Get full access" twice, or opens two tabs: only one subscription is created and they are not charged twice.
- Payment succeeds but the learner closes the tab before returning: access still turns on, because it depends on the payment result, not on the learner's return.
- The learner returns from payment before the payment notification is processed: the page shows a calm "Setting things up…" state and updates by itself without asking for a reload.
- Payment is pending (for example a bank check): the learner stays on Free, sees a calm pending message, and access turns on when it clears.
- A renewal payment fails: the learner is told kindly and given a way to update their payment method; access continues while the provider is still retrying and ends only when the subscription ends.
- A refund or a dispute ends a subscription: access ends from that point; hours and progress are kept.
- A learner switches between Monthly and Yearly: the change is made from settings and never leaves them without access in between.
- Two languages: a subscription gives Full access across all languages; hours stay per language and are untouched.
- A video's access value is missing or invalid: content validation fails before release; at runtime an unknown value is treated as full access, never accidentally free.
- Someone requests a full-access video's media or transcript directly without access: neither is served; media needs a server-issued token that only learners with access receive, and the page shows only the locked state.
- A learner's email changes: the subscription stays attached to the account, not the email.
- The payments service is temporarily unavailable: pricing and library still load; "Get full access" shows a calm "try again in a moment" message; existing subscribers keep their access.
- Locked state for a screen-reader user: the locked marker and its reason are announced, and the pricing link is reachable by keyboard.

## Requirements *(mandatory)*

### Functional Requirements

**Access rules**

- **FR-001**: Every video MUST be either free or full access, taken from its content file. A video with a missing or unrecognised value MUST be treated as full access.
- **FR-002**: A learner with no active subscription MUST be able to watch every free video, with its transcript, and MUST NOT be able to play, or read the transcript of, any full-access video.
- **FR-003**: A learner with an active subscription MUST be able to watch every video in every language.
- **FR-004**: Access MUST be decided on the server for each request to play a video or read its transcript; hiding things in the interface alone is not enough. The video file of a full-access video MUST only be playable with a short-lived token issued by the server to a learner with access; free videos stay public.
- **FR-005**: A signed-out visitor MUST be treated as having no subscription, and the Spec 4 rule that videos need an account is applied first: signed-out visitors see the account prompt, never the locked state or the player.
- **FR-006**: Hours, roadmap position, rhythm, level, settings and transcript preferences MUST NOT depend on subscription status and MUST NOT be altered, hidden or removed when a subscription is cancelled, ends or fails.

**Locked state**

- **FR-007**: Library cards for full-access videos shown to a learner without access MUST display a calm locked marker, keeping title, host, stage and duration visible. Cards for free videos, and all cards for subscribed learners, MUST NOT show it.
- **FR-008**: The player page for a locked video MUST show the title, host, a short kind explanation and a link to the pricing page, in place of the video and transcript.
- **FR-009**: The locked state MUST NOT use pop-ups, modals, blocking overlays, countdowns, urgency language or guilt. It MUST be an ordinary part of the page.
- **FR-010**: The locked state MUST be accessible: the reason is available to assistive technology, the pricing link is keyboard-reachable with a visible focus, and contrast and touch targets meet the design system.
- **FR-011**: "Up next", the library and the host page MUST still show locked videos as locked rather than hide them, autoplay MUST NOT carry a learner into a locked video, and "Pick up where you left off" MUST skip videos the learner can no longer watch.
- **FR-012**: The Done for today screen and the hours counter MUST be unaffected by access state.

**Subscribing**

- **FR-013**: The pricing page MUST let a learner choose Monthly or Yearly and start a subscription for the chosen period from the Full access button.
- **FR-014**: A signed-out visitor pressing the Full access button MUST be taken through sign-in or account creation and then continue to payment for their chosen period.
- **FR-015**: Payment details MUST be collected by the payment provider's secure hosted page; Instik MUST NOT see or store card numbers.
- **FR-016**: After successful payment the learner MUST return to Instik and see a short, warm confirmation. After a cancelled or failed payment they MUST see a calm message and remain unchanged.
- **FR-017**: A learner with an active subscription MUST NOT be offered a second purchase; the pricing page MUST show that they already have Full access and link to account settings.
- **FR-018**: Repeated or concurrent attempts to subscribe MUST result in at most one active subscription and one charge per learner. Starting a purchase while the learner already has a subscription that has not ended MUST lead to settings instead, and a second active subscription found later MUST be recorded for review and never replace the first.
- **FR-019**: Subscribing MUST be available only once real prices are configured. While prices are placeholders the Full access button MUST keep its Spec 6 behaviour (onboarding, or the library when signed in) and MUST NOT start a charge.

**Access follows payment**

- **FR-020**: A learner's access MUST turn on as soon as their payment succeeds, without requiring them to sign out, and normally within a few seconds.
- **FR-021**: A learner's access MUST end when their subscription ends (paid period over after cancelling, or the provider ends it after failed renewals, a refund or a dispute), and not earlier.
- **FR-022**: Changes to payments and subscriptions MUST be received from the payment provider, verified as genuinely from the provider, and applied so that repeated, delayed or out-of-order notifications leave access correct and never double-apply.
- **FR-023**: The learner's current subscription status (plan, period, status, current period end, whether it ends at period end) MUST be stored with the account and be the only basis for access decisions.
- **FR-024**: If a notification cannot be matched to a learner, or cannot be read as expected, it MUST be recorded for review and MUST NOT grant access to anyone.
- **FR-025**: When the learner returns from payment before the provider's notification has been processed, the page MUST show a calm waiting state and refresh by itself.

**Managing and cancelling**

- **FR-026**: Account settings MUST show a plan section: Free, or Full access with period, price, status and next renewal or end date.
- **FR-027**: Subscribed learners MUST be able to open the provider's secure page from settings to update their payment method and see invoices.
- **FR-028**: Subscribed learners MUST be able to cancel from settings in two presses: one to start and one to confirm. The confirmation MUST state the date access continues until, and MUST NOT include retention offers, hidden steps or shaming copy.
- **FR-029**: After cancelling, access MUST continue until the end of the paid period, settings MUST show "Access until [date]", and the learner MUST be able to resume before that date without a gap or a second charge.
- **FR-030**: When a subscription ends, settings MUST show Free with a link to pricing, and the learner can subscribe again at any time.
- **FR-031**: Switching between Monthly and Yearly MUST be possible from settings, MUST take effect at the end of the current paid period with no proration, MUST say so in settings, and MUST never leave the learner without access during the change.

**One price configuration**

- **FR-032**: Plans, billing periods, amounts, currency and the yearly saving MUST be defined in one place, and the pricing page, checkout, account settings and any other price mention MUST read from it.
- **FR-033**: The yearly saving shown MUST be calculated from the monthly and yearly amounts, not entered separately.
- **FR-034**: While prices are undecided, the configuration MUST hold clearly marked placeholders that render as in the approved design, and no real amount may appear anywhere.
- **FR-035**: The configuration MUST be validated when the app is built or started; missing, zero, negative or inconsistent amounts MUST fail loudly rather than reach learners.

**Design, copy and quality**

- **FR-036**: New and changed screens (pricing states, locked card, locked player, settings plan section, confirmation and waiting states) MUST follow the design system and the brand voice: short, warm, honest, never shaming.
- **FR-037**: The pricing page MUST remain visually identical to `docs/design/Pricing.dc.html` for a signed-out visitor, apart from the states this spec adds.
- **FR-038**: The core access rule, the price configuration and the handling of repeated or out-of-order notifications MUST be covered by tests.
- **FR-039**: Payment-related secrets MUST never reach the browser, and every incoming payment notification and learner action MUST be validated before use.
- **FR-040**: The feature MUST NOT introduce streaks, countdowns, urgency banners or unqualified promises about learning outcomes.

### Key Entities

- **Plan**: The Free and Full access offerings, with the billing periods (Monthly, Yearly), amounts, currency and the calculated yearly saving, all from the single price configuration.
- **Subscription**: A learner's paid access. Belongs to one account. Holds plan, billing period, status (active, cancelled but still active, ended), current period end, whether it will end at period end, and a reference to the provider's record.
- **Access level**: Derived from the subscription: Free or Full. Applies across all languages.
- **Video access**: The free or full value on each video's content file.
- **Payment event**: A record of a notification received from the payment provider, kept so repeated or out-of-order notifications can be recognised and unmatched ones reviewed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can go from the pricing page to a confirmed, working subscription in under 3 minutes (excluding time spent entering their own payment details).
- **SC-002**: After a successful payment, 95% of learners can play a previously locked video within 10 seconds of returning to Instik, without signing out.
- **SC-003**: After a subscription ends, no full-access video plays for that learner at the next request, and 100% of their hours, roadmap and rhythm data remain unchanged.
- **SC-004**: 100% of requests for a full-access video or its transcript by a learner without access are refused, including direct requests that skip the interface.
- **SC-005**: A subscribed learner can cancel in two presses from account settings, and sees the date access continues until before confirming.
- **SC-006**: A cancelled learner keeps full access until the paid period ends: 0 cases of early loss and 0 cases of access continuing after the end.
- **SC-007**: Sending the same payment notification 5 times, or out of order, leaves the learner with exactly one subscription and correct access, and no repeated charge.
- **SC-008**: Changing one price in the configuration updates the pricing page, settings and checkout together, and no price is typed anywhere else in the app.
- **SC-009**: No screen in this feature shows a modal, pop-up wall, countdown, streak or shaming message; the locked state is readable and operable by keyboard and screen reader on phone, tablet and desktop.
- **SC-010**: In a review of the pricing page against the design at phone, tablet and desktop widths, there are no visible differences beyond the states this spec adds.

## Assumptions

- The payment provider is still an open decision in `docs/product.md`. This spec is written so any provider offering hosted checkout, a customer portal and verifiable notifications can be used; the choice is made in planning, behind a thin interface.
- Prices are still placeholders. Real amounts, currency and yearly saving are supplied through the price configuration later; until then FR-019 applies and no charge can start.
- There is one paid plan, Full access, offered monthly or yearly. It covers all languages and all videos. The Free and Full lists on the pricing page stay as designed.
- Cancelling stops renewal at the end of the paid period. Refunds follow the provider's standard process and are not a learner-facing flow here; a refund ends access from that point and never touches hours.
- A failed renewal follows the provider's standard retry schedule; access continues during retries and ends when the provider ends the subscription.
- Switching between Monthly and Yearly takes effect at the end of the current paid period with no proration (decided); settings state this in one sentence.
- Full-access videos are uploaded to the video host with signed playback, and free videos with public playback; this is a content step done at upload and is part of the launch checklist.
- No free trial is included; "Start free" on the pricing page is the Free plan.
- Tax, invoices and receipts are produced by the payment provider; the learner reaches them through the provider's secure page. Instik sends no marketing email.
- The free "starter set" is whichever videos are marked free in their content files; the split is a content decision and needs no code change.
- Accounts and sign-in come from Spec 4; the library, player and settings come from Specs 2, 3 and 4; Spec 6 supplies the pricing page that this spec makes live and noted that Free and Full limits were descriptive only.
- Out of scope: discounts and coupons, gift cards, team or family plans, free trials, learner-facing refund flows, extra currencies beyond the one configured, and in-app upgrade marketing.
