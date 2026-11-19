# Feature Specification: Creator Statistics and Monthly Earnings

**Feature Branch**: `011-creator-earnings` (work continues on `develop`; no branch hook is registered)

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Spec 11: creator statistics and monthly earnings. Read docs/product.md (Creator earnings) and docs/design/CreatorDashboard.dc.html and OwnerEarnings.dc.html first. Counted views follow product.md exactly: at least 30 seconds of honest watch time, at most once per learner per video per day, only from learners with active full access at that time. Creator dashboard as designed: video counts by status; this month's counted views, watch hours, unique learners and average completion; views per week; top videos with their فاهم؟ answers; requests from Instik; and earnings (estimated this month, last month final, next payout date). Owners can post content requests that all creators see. Owner earnings page: for each month, gross subscription revenue, minus VAT, payment fees and refunds, gives net revenue; 80% goes to the creator pool and 20% to Instik; each creator's share is their share of counted views. The owner closes a month, which locks its numbers, then marks each creator as paid. Creators only ever see their own numbers. No payment gateway is chosen yet: monthly revenue (gross, VAT, payment fees, refunds) comes from one revenue source that for now is entered manually by an owner on the earnings page, and can later be filled by the chosen gateway without changing the earnings logic. Owners can grant and remove full access for any account manually (for testing, creators or gifts), with every grant recorded; counted views from those accounts count as paying learners. Months follow the Europe/Warsaw time zone, as in spec 10. Out of scope: automatic payouts and any payment gateway integration."

## Clarifications

### Session 2026-11-18

- Q: While an open month has no revenue entered yet, what should a creator's "estimated this month" show? → A: "Not available yet" until an owner enters revenue for the month; owners can enter running figures at any time and the estimate then updates. No estimate is borrowed from last month.
- Q: Should an adjustment recorded in the open month (correcting an earlier closed month) reduce net revenue before the 80/20 split, or come off Instik's 20% only? → A: It is added to or subtracted from the open month's net revenue before the split, so creators and Instik share it 80/20.
- Q: If this feature goes live partway through a month, should earlier watching that month count, or only watching from release day? → A: Only from release day onward; the release month's pool is split on the views counted after release.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Count views honestly (Priority: P1)

When a learner with full access watches a video, the product decides whether that watching earns the video's creator one counted view. A view counts when the learner has watched at least 30 seconds of honest watch time (the same rules as Hours: playing and tab visible) of that video on a day, they have not already produced a counted view for that video that day, and they had active full access at that moment. Everything else (free-plan learners, short glances, repeat watching the same day) still counts toward the learner's own Hours but never earns a counted view.

**Why this priority**: Every statistic and every euro in this spec rests on this rule. If it is wrong, the dashboard misleads creators and the money is split unfairly.

**Independent Test**: With test learners on full access, on the free plan, and with a manual grant, watch videos for 10, 30 and 120 seconds, twice in one day and again the next day, then check which counted views exist. No dashboard or earnings page is needed.

**Acceptance Scenarios**:

1. **Given** a learner with active full access, **When** they accumulate 29 seconds of honest watch time on a video and stop, **Then** no counted view exists; **When** they reach 30 seconds, **Then** exactly one counted view exists for that learner, video and day.
2. **Given** that learner already produced a counted view for that video today, **When** they keep watching or watch it again today, **Then** no second counted view is made; **When** they watch it tomorrow and again reach 30 seconds, **Then** one new counted view is made for tomorrow.
3. **Given** a learner on the free plan, or whose full access has ended, **When** they watch 30 seconds or more, **Then** their Hours still grow but no counted view is made.
4. **Given** a learner whose full access ended after they produced a counted view, **When** the month is reviewed later, **Then** that counted view is still there: access is judged at the moment of watching, not afterwards.
5. **Given** an account with a manual full-access grant, **When** it watches 30 seconds of a video, **Then** the counted view is made exactly as for a paying learner.
6. **Given** a creator watching their own video, **Then** no counted view is made for it.

---

### User Story 2 - Owner sees a month's statement and each creator's share (Priority: P1)

An owner opens the Earnings page and picks a month (open or closed). For an open month they enter the month's revenue figures: gross subscription revenue, VAT collected, payment fees and refunds, each in euros and cents. The page shows net revenue (gross minus VAT, fees and refunds), the creator pool (80%), Instik's share (20%), the month's total counted views, and a table of creators with their counted views, their share of all counted views as a percentage, and their earnings in euros. The figures are labelled as estimates while the month is open.

**Why this priority**: This is the heart of the money logic and the only way the owner can see what creators are owed. It also proves the revenue source can be swapped later, because the earnings logic only ever reads the four revenue figures.

**Independent Test**: Enter revenue of €3,000.00 gross, €561.00 VAT, €96.00 fees and €43.00 refunds for a month with known counted views per creator, and check net €2,300.00, pool €1,840.00, Instik €460.00 and every creator's earnings add up to no more than the pool.

**Acceptance Scenarios**:

1. **Given** revenue figures for a month, **Then** net revenue equals gross minus VAT, fees and refunds, the pool is 80% of net and Instik's share is the rest, all in whole cents.
2. **Given** four creators with 3,680, 2,300, 1,840 and 1,380 counted views (9,200 total), **Then** their shares are 40%, 25%, 20% and 15% and their earnings are the same shares of the pool.
3. **Given** shares that do not divide into whole cents, **Then** the creators' earnings add up to exactly the pool when at least one creator has counted views, and never to more than it; the leftover cents follow a fixed rule stated on the page's help text.
4. **Given** no revenue has been entered for an open month, **Then** the page says revenue has not been entered yet, shows counted views per creator, and shows no euro amounts rather than €0.00.
5. **Given** a month with no counted views, **Then** no creator earns anything and the page says so plainly; the pool is not handed to anyone.
6. **Given** the owner changes a revenue figure on an open month, **Then** every derived figure updates and the change is recorded with who and when.
7. **Given** a creator or learner tries to open the Earnings page or read its numbers, **Then** they are refused and nothing is returned.

---

### User Story 3 - Creator sees their own dashboard (Priority: P1)

A creator opens their dashboard and sees, as designed:

- Four video counts: Videos uploaded, In review, Approved and Changes requested.
- This month's counted views, watch hours, unique learners and average completion (across the creator's videos that learners watched this month).
- A chart of counted views per week, with the current week marked as in progress.
- Earnings: the estimate for this month, last month's final amount with its paid date once paid, and the next payout date, with a short plain explanation of how views earn money.
- Top videos this month, each with its stage, counted views, watch hours, completion and a bar showing the فاهم؟ answers (mostly, some of it, not yet).
- Requests from Instik: the content requests the owners have posted.

Every figure is the creator's own. Nothing on the page shows or lets them infer another creator's videos, views or earnings, and nothing identifies an individual learner.

**Why this priority**: It is the main reason creators come back, and the one place they learn whether their work is valued.

**Independent Test**: Sign in as a creator with approved, in-review and changes-requested videos and known counted views, and check every tile, the chart, the table, the earnings card and the requests against the known data; then sign in as a second creator and check none of the first creator's numbers appear.

**Acceptance Scenarios**:

1. **Given** a creator with 14 videos (10 approved, 2 in review, 1 with changes requested, 1 draft), **Then** "Videos uploaded" is 14, with In review 2, Approved 10 and Changes requested 1.
2. **Given** counted views across the last five weeks, **Then** the chart shows one bar per week with its number, the week in progress is marked, and the chart has a text alternative listing the numbers.
3. **Given** a month with revenue entered, **Then** the earnings card shows the estimate for this month labelled "estimated", last month's final amount (and "paid" with the date once marked paid, or "payment pending"), and the next payout date.
4. **Given** no revenue has been entered for this month, **Then** the earnings card says the estimate is not available yet instead of showing €0.00, and still shows counted views.
5. **Given** a new creator with no approved videos, **Then** every tile shows zero or a calm "nothing yet" line, the chart and table are empty states with a short kind note, and no figure reads as shaming.
6. **Given** a video whose learners mostly answered "not yet" to فاهم؟, **Then** the table shows a mostly-coral bar and the page explains that lots of "not yet" usually means the video is harder than its stage.
7. **Given** a creator tries to read another creator's dashboard numbers by any route, **Then** nothing is returned.

---

### User Story 4 - Owner closes a month and records payouts (Priority: P2)

Once a month has ended in Europe/Warsaw time, an owner closes it. Closing locks the month's revenue figures, counted views and every creator's earnings, which are stored as they were at that moment. The owner then sends each creator their money by bank transfer outside the product and marks that creator as paid, adding a reference (for example the transfer reference). The creator's dashboard then shows that month as final and paid.

**Why this priority**: It turns estimates into promises and records who has been paid. It depends on Stories 1 and 2.

**Independent Test**: With an ended month and revenue entered, close it, check the numbers can no longer be changed, mark one creator paid with a reference and check the other stays unpaid and the creator's dashboard reflects it.

**Acceptance Scenarios**:

1. **Given** a month that has not yet ended in Europe/Warsaw time, **Then** it cannot be closed; **Given** an ended month with revenue entered, **Then** the owner can close it after a calm confirmation that says it locks the numbers.
2. **Given** a month with no revenue entered, **Then** it cannot be closed, and the page says what is missing.
3. **Given** a closed month, **Then** its revenue, counted views, shares and earnings cannot be edited by anyone, and later changes to access or videos never change them.
4. **Given** a closed month, **When** the owner marks a creator as paid with a reference, **Then** the payout is recorded with the creator, month, amount, the owner who marked it, the time and the reference, and the creator sees "Paid" with that date.
5. **Given** a payout was marked by mistake, **Then** it is not edited or deleted: the owner adds a reversing record and may then mark it paid again; the history stays visible to owners.
6. **Given** a refund or correction arrives for a closed month, **Then** the owner records it as an adjustment in the current open month (never by reopening the closed one), and it appears there as its own labelled line.
7. **Given** closing is attempted twice (a double click, two owners), **Then** the month is closed once and nothing is duplicated.

---

### User Story 5 - Owner grants and removes full access by hand (Priority: P2)

An owner finds any account by email and gives it full access, with a reason (testing, creator, gift or other) and an optional note, or removes the full access they gave. The account immediately has the same full access as a paying learner on the learner site, and its watching counts toward counted views like any paying learner's. Every grant and every removal is recorded with who did it, when, the account, the reason and the note, and the owner can see the history.

**Why this priority**: It lets the team test the whole money flow before a payment gateway exists, and gift access to creators and partners. It is needed to verify Story 1 end to end.

**Independent Test**: Grant full access to a test account, check the learner site unlocks full-access videos for it, watch 30 seconds and check one counted view, remove the grant, and check access and later counting stop while the earlier counted view remains.

**Acceptance Scenarios**:

1. **Given** an owner and a learner account on the free plan, **When** the owner grants full access, **Then** the learner can watch full-access videos at once and the grant appears in the history.
2. **Given** a granted account, **When** the owner removes the grant, **Then** access returns to what the account would have without it (free, or its own subscription if it has one) and the removal appears in the history.
3. **Given** an account that also has a paid subscription, **Then** removing a manual grant never affects the paid subscription, and granting never creates a second payment.
4. **Given** an email that matches no account, **Then** the owner is told no account with that email exists yet, and nothing is created.
5. **Given** a creator or learner tries to grant or remove access, **Then** they are refused.
6. **Given** a grant was made, **Then** the history can never be edited or deleted; ending a grant is a new record.

---

### User Story 6 - Owner posts content requests creators see (Priority: P3)

An owner writes a short request for the kind of video learners need next, choosing a stage and a topic and adding one or two sentences (for example "Follow it · Food: Cooking at home, ordering street food."). Every creator sees the open requests on their dashboard under "Requests from Instik". An owner can edit a request or close it when it is no longer needed; closed requests disappear from the creators' dashboards but stay in the owner's list.

**Why this priority**: It helps creators make what learners want, but the product works without it.

**Independent Test**: Post two requests as an owner, check both show for two different creators, close one and check only the other remains.

**Acceptance Scenarios**:

1. **Given** an owner posts a request with stage, topic and text, **Then** every creator, paused or not, sees it on their dashboard.
2. **Given** several open requests, **Then** the dashboard lists them newest first and the list has a visible end.
3. **Given** an owner closes a request, **Then** it no longer appears on any dashboard, and the owner can still see it as closed.
4. **Given** a request with empty text or text over the length limit, **Then** the owner is asked to shorten or complete it, in plain words, and nothing is saved.
5. **Given** a creator or learner tries to post, edit or close a request, **Then** they are refused; learners never see requests.

---

### Edge Cases

- A learner watches the same video just before and just after midnight: they get one counted view for each day, each judged by that day's watch time, never one split across two days.
- Watch time reaches 30 seconds on one device while another device is also watching: the once-per-day rule still allows only one counted view for that learner, video and day.
- A video is later withdrawn or its creator is paused: counted views already made stay with the creator for that month, and a paused creator still earns from their live videos.
- A creator's account is removed after a month is closed: the closed statement keeps the creator's name and amounts as they were.
- A month's revenue is entered after views have been counted, or revenue is changed several times before closing: only the latest figures count, and every change is recorded.
- Refunds exceed gross revenue, or VAT plus fees plus refunds exceed gross: net revenue is shown as €0.00 (never negative), the page explains why, and nobody earns anything that month.
- A creator has counted views but the month has no revenue yet: their dashboard shows their views and says earnings are not available yet.
- Two owners edit the same month's revenue at the same time: the second save is told the figures changed and is asked to reload, so one owner's numbers never silently overwrite the other's.
- A creator with counted views in a month is not paid because the owner has not yet marked them: the dashboard says "Payment pending" in calm words, never "overdue".
- Percentages are shown rounded to one decimal place; they are for display only and never used to compute money.
- An account is granted full access and the same account is the creator of the video it watches: no counted view is made (own videos never count).

## Requirements *(mandatory)*

### Functional Requirements

**Counted views**

- **FR-001**: The system MUST record a counted view for a learner, a video and a day when the learner's honest watch time for that video that day reaches 30 seconds, the learner has active full access at that moment, and no counted view already exists for that learner, video and day.
- **FR-002**: Honest watch time for counting MUST follow the same rules as Hours (video playing and tab visible); paused, buffering, hidden-tab and background time never counts.
- **FR-003**: A counted view MUST be judged on access at the moment it is made and MUST NEVER be removed or recreated afterwards because access later changes, a video is withdrawn, a creator is paused or an account is deleted (except by deleting the learner's data under the privacy rules, which removes the learner link but keeps the counted total).
- **FR-004**: Active full access MUST mean a currently active paid subscription OR an active manual grant; free-plan learners and lapsed subscribers never produce counted views.
- **FR-005**: A creator's own watching of their own videos MUST NOT produce counted views.
- **FR-006**: A counted view MUST belong to the month it was made in, using Europe/Warsaw time, and to the video's creator at that time.
- **FR-007**: Counting logic MUST live in one pure, tested module with no user-interface or database code mixed in.

**Creator dashboard**

- **FR-008**: The creator dashboard MUST show video counts (uploaded, in review, approved, changes requested), this month's counted views, watch hours, unique learners and average completion, counted views per week, earnings, top videos this month and requests from Instik, as in the approved design.
- **FR-009**: "Watch hours" MUST be the honest watch time of the creator's approved videos this month, shown in hours (all of it, whether or not it produced a counted view); "unique learners" MUST be the number of different learners who produced a counted view on the creator's videos this month; "average completion" MUST be the average share of each video that learners have watched this month, across the creator's videos that were watched this month (videos nobody watched this month are left out).
- **FR-010**: "Views per week" MUST show the counted views of each of the last five weeks (weeks start on Monday in Europe/Warsaw time) and mark the week in progress.
- **FR-011**: "Top videos this month" MUST list at most five of the creator's own videos by counted views, each with stage, counted views, watch hours, completion and the proportions of "mostly", "some of it" and "not yet" answers to فاهم؟, with the legend and the colour meaning also given in words.
- **FR-012**: The dashboard MUST show the estimated earnings for the current month labelled as an estimate, last month's final amount with its paid date or "Payment pending", and the next payout date, together with the plain explanation of how earnings work from the design.
- **FR-013**: When revenue has not been entered for a month, the dashboard MUST say the earnings estimate is not available yet and MUST NOT show a zero amount, or a figure borrowed from another month, in its place. Owners may enter running figures at any time during the month, and the estimate then updates from them.
- **FR-014**: A creator MUST only ever receive their own numbers; the dashboard MUST NOT show, count, list or let a creator infer another creator's videos, views, earnings, payouts or the month's total revenue and pool, and MUST NOT identify any individual learner.
- **FR-015**: The dashboard MUST show calm empty states for a creator with no approved videos or no views, with no shaming comparison, rank or streak.

**Content requests**

- **FR-016**: An owner MUST be able to create, edit and close a content request made of a stage, a topic and a short text (at most 200 characters), and every creator MUST see all open requests on their dashboard, newest first.
- **FR-017**: Only owners can create, edit or close requests; learners never see them; closed requests are hidden from creators and remain visible to owners.

**Revenue source and earnings**

- **FR-018**: Earnings MUST be computed only from one monthly revenue record containing gross subscription revenue, VAT, payment fees and refunds in integer cents with a currency, and from the month's counted views; nothing in the earnings logic may depend on where the revenue figures came from.
- **FR-019**: For now the revenue record MUST be entered and edited by an owner on the Earnings page, and the product MUST be arranged so that a payment gateway can later fill the same record without changing how net revenue, the pool, shares, rounding, closing or payouts work.
- **FR-020**: Net revenue MUST equal gross minus VAT, payment fees and refunds, plus or minus any adjustments recorded in that month, never below zero; 80% of net revenue MUST go to the creator pool and the remainder to Instik; each creator's share of the pool MUST be their counted views divided by the month's total counted views.
- **FR-021**: All amounts MUST be integer cents with a currency stored alongside (euros for now); floating-point money is forbidden anywhere in the calculation.
- **FR-022**: Rounding MUST NEVER make the creators' earnings add up to more than the pool; when any creator has counted views the earnings MUST add up to exactly the pool, with leftover cents given one at a time by a fixed documented rule (largest fractional remainder first, ties to the creator who joined earlier).
- **FR-023**: Entering or changing a revenue figure MUST be recorded with who and when, MUST refuse negative amounts and amounts that are not whole cents, and MUST be refused for a closed month.
- **FR-024**: The Earnings page MUST list months with their status (open or closed), show for the chosen month the statement from gross to net, the 80/20 split, total counted views, and a table of creators with counted views, percentage share, earnings and payout state, and label every open-month figure as an estimate.
- **FR-025**: The Earnings page and every earnings, revenue, closing and payout action MUST be available to owners only and MUST refuse creators, learners and signed-out visitors on the server with no data returned.
- **FR-026**: The earnings calculation MUST live in one pure, tested module that takes the revenue figures and each creator's counted views and returns the statement, never mixed into display code.

**Closing and payouts**

- **FR-027**: An owner MUST be able to close a month only after it has ended in Europe/Warsaw time and only when its revenue has been entered; closing MUST store the final revenue figures, total counted views and each creator's counted views, share and earnings, and MUST lock them.
- **FR-028**: A closed month MUST NEVER change. Corrections (refunds, errors) MUST be recorded as labelled adjustments in a later open month, where each one is added to or subtracted from that month's net revenue before the 80/20 split (so it is shared 80/20 like any other revenue), and closing the same month twice MUST do nothing the second time.
- **FR-029**: After a month is closed, an owner MUST be able to mark each creator's earnings as paid, recording the creator, month, amount in cents with its currency, the owner who marked it, the time and a reference. Payout records are append-only; a mistake is fixed by a reversing record, never by editing or deleting.
- **FR-030**: A creator whose earnings for a closed month are zero MUST NOT need a payout record.
- **FR-031**: The product MUST NOT send money or contact any payment provider; payouts are made by the owner outside the product and only recorded here.

**Manual access**

- **FR-032**: An owner MUST be able to grant full access to any existing account by email, with a reason (testing, creator, gift or other) and an optional note, and to remove a grant they or another owner made.
- **FR-033**: An account with an active manual grant MUST have the same full access on the learner site as a paying subscriber, and its honest watching MUST count toward counted views exactly like a paying learner's.
- **FR-034**: Every grant and every removal MUST be recorded with who did it, when, the account, the reason and the note; records are append-only and visible to owners, and removing a grant MUST NOT affect an account's own paid subscription.
- **FR-035**: Granting or removing access MUST be refused for creators, learners and signed-out visitors on the server.

**Cross-cutting**

- **FR-036**: Every month, week and day boundary in this feature MUST use the Europe/Warsaw time zone.
- **FR-037**: Every read and write in this feature MUST check the acting user's role on the server, scoped by ownership for creators, in the same place as the other role rules (constitution XI); hiding a button is never enough.
- **FR-038**: Every input (revenue amounts, request text, grant email and reason, payout reference, month) MUST be validated on the server with plain-language refusals that say what to do next and never shame.
- **FR-039**: The new screens MUST follow the approved designs, the design tokens, the brand voice (short, warm, honest), accessibility rules (labelled controls, 44px targets, text contrast, a text alternative to the chart and the answer bars) and have visible ends on every list with no infinite scroll.
- **FR-040**: Earning figures shown to creators during the current month MUST be called "estimated"; hour thresholds and learner-facing copy keep the brand rule that estimates are always called estimates.

### Key Entities *(include if feature involves data)*

- **Counted view**: One learner's one video on one day that earned the creator a view. Records the learner, video, creator at the time, the day, the moment it was counted and the month it belongs to; never edited, and unique per learner, video and day.
- **Monthly revenue**: The four figures for one calendar month (gross subscription revenue, VAT, payment fees, refunds) with a currency, the source they came from (for now "entered by an owner"), and who changed them and when. Replaceable by a gateway-filled record of the same shape.
- **Adjustment**: A labelled signed amount recorded in an open month to correct an earlier closed month, with a note and who recorded it; it changes that month's net revenue before the split.
- **Monthly statement**: The calculation for a month: net revenue, creator pool, Instik's share, total counted views and one line per creator with counted views, share and earnings. Estimated while open; stored and locked when closed.
- **Month close**: The record that a month is closed, who closed it and when.
- **Payout record**: One creator's payment for one closed month: amount in cents with its currency (the month's), who marked it, when, the reference, and whether it reverses an earlier record. Append-only.
- **Manual access grant**: A record of full access given to an account by an owner: reason, note, who, when, and the matching removal. Append-only.
- **Content request**: A short note from the owners with stage, topic and text, open or closed, with who posted it and when.
- **Creator**: Existing account with the creator role; owns videos and receives counted views and earnings.
- **Learner**: Existing account; its watch time produces counted views and, for the creator's pages, only counts, never identities.
- **Video**: Existing; the unit that counted views, completion and فاهم؟ answers attach to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a month with known revenue and counted views, the owner's statement matches an independent hand calculation to the cent, and the creators' earnings never total more than the creator pool in any tested case, including awkward cent splits.
- **SC-002**: An owner can enter a month's four revenue figures and see the full statement in under 2 minutes.
- **SC-003**: An owner can close an ended month and mark one creator as paid, with a reference, in under 2 minutes.
- **SC-004**: A closed month's figures are identical every time they are viewed afterwards, whatever happens to access, videos or creators.
- **SC-005**: In tests of the counting rule, 100% of the following cases are correct: below 30 seconds, exactly 30 seconds, repeat watching in a day, a new day, free-plan learner, lapsed learner, manually granted account, and a creator watching their own video.
- **SC-006**: A creator opening their dashboard sees every figure in the design within 3 seconds on a normal connection, and a creator with no activity sees calm empty states rather than errors.
- **SC-007**: Across every creator-facing and owner-facing read and action, a creator, a learner or a signed-out visitor attempting to reach another creator's numbers, or any owner function, receives nothing in 100% of tests.
- **SC-008**: A new creator can understand how their earnings work from the dashboard alone, with no need to ask: the explanation is on the page and uses the words estimated, final and paid consistently.
- **SC-009**: A manual grant gives access within seconds and every grant and removal is findable in the history with who and when in 100% of tests.
- **SC-010**: An owner can post a content request and see it on a creator's dashboard in under 1 minute.
- **SC-011**: Swapping the source of the revenue figures from manual entry to another source requires no change to how net revenue, the pool, shares, rounding, closing or payouts are calculated, demonstrated by computing the same statement from two different sources.

## Assumptions

- **Currency**: Euros, as in the designs; every amount stores its currency so another can be added later.
- **Source of truth for what is counted**: Honest watch time, access and learner day come from the existing honest-hours and billing features (specs 5 and 7); counted views start from the day this feature is released, and earlier watching is not counted retroactively; the release month is a partial month and its pool is split on the views counted after release.
- **Day for the once-a-day rule**: The learner's day, as in Hours. The month a counted view belongs to is the Europe/Warsaw month of the moment it was counted.
- **Estimate while revenue is missing**: No euro amounts are shown until an owner has entered revenue for that month.
- **Months with no counted views**: Nobody earns; the pool is not carried to another month or given to anyone.
- **Creators included in a statement**: Only creators with at least one counted view in that month have a line.
- **Payout timing**: Payouts are made by bank transfer on or around the 5th of the month after a month is closed, which is the "next payout date" shown to creators (as in the design); this date is a display convention and is not enforced.
- **Closing**: A month can be closed from the first moment of the next month in Europe/Warsaw time; closing earlier months before later ones is not required.
- **Corrections**: Adjustments are entered by an owner as signed euro amounts with a note into the open month and appear in the statement as their own line, changing that month's net revenue before the split.
- **Manual grants have no end date**: They last until removed; an optional end date can come later.
- **Own videos**: A creator's watching of their own videos never counts, to keep the pool honest.
- **Product doc**: `docs/product.md` Earnings screen (16) and Roles already cover the statement, split, shares, mark as paid and close the month; the manual revenue entry, content requests screen controls, adjustments and manual access grants are small additions that `docs/product.md` will be updated to mention (constitution principle I) when this spec is planned.
- **Learner privacy**: Creators and owners see only counts, never which learner produced a view; deleting a learner's account removes the personal link but not the creator's counted total.
- **Roles**: Owners are set by the configured owner list (spec 8); the creator, owner and paused-creator rules from specs 8–10 stay as they are.

## Out of Scope

- Automatic payouts, bank integrations and any payment gateway integration (revenue is entered by hand for now).
- Pulling revenue, VAT, fees or refunds from Stripe or any other provider.
- Invoicing, tax reporting, tax forms and creator contracts.
- Multi-currency conversion.
- Learner-facing changes beyond the access a manual grant gives.
- Notifications or emails about earnings, payouts or requests.
