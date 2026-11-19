# Quickstart: validate spec 11

Run from the repository root. Prerequisites: the spec 8–10 migrations applied, a signed-in owner (an email in `OWNER_EMAILS`), at least two
creators with approved videos, and learner accounts. No payment gateway is needed.

## 0. Prepare

```text
npm run db:migrate        # applies the creator_earnings migration
npm run db:deploy         # applies the triggers migration (run after the first)
npm run dev
```

## 1. Automated checks

```text
npm run lint
npx tsc --noEmit
npx vitest run tests/unit/earnings tests/unit/grants tests/unit/requests tests/unit/billing tests/unit/owner-access.test.ts
npm run build
```

Expected: all green. The earnings suites cover counted-view rules, manual grants, the split and rounding, closing, a closed month refusing edits,
and a creator reading another creator's numbers.

## 2. Counted views (User Story 1)

1. As owner, open `/owner/access`, grant full access to a test learner (reason "Testing").
2. As that learner, play an approved video for 29 seconds, then 31 seconds: no counted view before 30, exactly one at 30 (see the creator's
   dashboard: Counted views +1 within a minute).
3. Keep watching and reload: still one for today. Next day: one more.
4. Remove the grant in `/owner/access`: access returns to free; the earlier view stays; new watching does not count.
5. As a creator, watch your own video as a granted account: no counted view.

## 3. Statement (User Story 2)

1. Open `/owner/earnings` for the current month. With no revenue, the page says revenue has not been entered and shows no euro amounts.
2. Enter gross 3000.00, VAT 561.00, fees 96.00, refunds 43.00. Expected: net 2,300.00, pool 1,840.00, Instik 460.00, shares add up to exactly 1,840.00.
3. Edit a figure in a second browser tab with the old version: the save is refused with "Figures changed. Reload to see them."

## 4. Creator dashboard (User Story 3)

1. Sign in as a creator: tiles, five weekly bars with the current week marked, earnings card ("estimated" while the month is open), top videos with answer
   bars, and the open requests.
2. Sign in as a second creator: none of the first creator's numbers appear.
3. Before revenue is entered, the earnings card says the estimate is not available yet.

## 5. Close and pay (User Story 4)

1. For an ended month with revenue, press "Close month" and confirm. Figures are locked (the revenue form disappears; an edit attempt is refused).
2. Press "Mark as paid" for one creator with a reference. The creator's dashboard shows "Paid" with the date; the others show "Payment pending".
3. Reverse the payout with a reason, then mark it again. The history keeps every record.
4. Add an adjustment in the open month for a late refund: it changes that month's net before the split.

## 6. Requests (User Story 6)

Post two requests in `/owner/requests`, check both appear for two creators, close one, check it disappears for creators and stays in the owner's list.

## 7. Timings

SC-002 (enter four figures and see the statement in under 2 minutes) and SC-003 (close a month and mark one creator paid in under 2 minutes) are timed by hand.
