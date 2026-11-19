# Research: Creator Statistics and Monthly Earnings

No `NEEDS CLARIFICATION` remained after the spec's clarification session. These are the design decisions the plan rests on.

## 1. When is a counted view created?

- **Decision**: Inside `recordHeartbeat`'s transaction, after each `WatchSession` upsert, note which day parts crossed the threshold: the
  day's seconds went from below 30 to 30 or more with this heartbeat (`before = after - added`). Nothing else happens in that transaction. **After
  the transaction commits**, `recordCountedViewIfCrossed` runs on its own, in its own `try/catch` that logs a failure and moves on. It checks, in
  order: the video is a database video with a creator, the learner is not that creator, the learner has full access at the heartbeat's time
  (subscription or manual grant). If all hold, it inserts a `CountedView` (unique on learner, video, day; the insert ignores a duplicate).
- **Rationale**: "At that moment" is exact; a learner who watched 40 free seconds and upgraded later does not suddenly count. One
  crossing per learner, video and day means no extra query on normal heartbeats, and the unique key makes a retry or a second device harmless.
  Counting after the commit keeps honest hours (constitution III) independent of counting: a failed SQL statement inside a Postgres transaction
  aborts the whole transaction, so a counting error inside the heartbeat would lose the learner's hours. The cost is that a crash between the
  commit and the count loses that one view; that is accepted (the learner's seconds are safe and a view is worth cents).
- **Alternatives considered**: a nightly job reading `WatchSession` (cannot know access at the time; Stripe state is only current);
  counting at any heartbeat once seconds are 30 or more (lets later access back-credit the day).

## 2. What "active full access" means for counting

- **Decision**: `hasFullAccess(subscription, now, manual)`: an active paid subscription (existing rule, including the 7-day stale limit) or an active
  manual grant. Counting does **not** use `canWatch`, because `canWatch` is true for free-access videos and a free learner can watch those.
- **Rationale**: the product rule is about the learner, not the video. This also matches the spec's "paying learner".

## 3. Manual grants and the one access function

- **Decision**: `User.manualAccessAt` (null = no grant, like `pausedAt`) is the fast flag; `AccessGrantEvent` is the append-only history (granted, removed,
  reason, note, who, when). Grant and removal write the flag and the event in one transaction. `hasFullAccess`, `canWatch` and `markLocked` take
  `manual: boolean` (default `false`); a new `getFullAccess(userId)` reads subscription and flag in one request-cached call, and every place that
  gates by access now uses it. Removing a grant never touches the subscription row.
- **Rationale**: same pattern as spec 10's pause; one rule everywhere; the history is separate and cannot be edited.
- **Alternatives considered**: a fake `ACTIVE` subscription row (would show a plan in settings and break the billing sync's assumptions);
  checking grants in a second function next to `hasFullAccess` (two rules that can drift).

## 4. Months, weeks and days

- **Decision**: A month key is `YYYY-MM` in Europe/Warsaw. A counted view stores `countedAt` (instant), `day` (the learner's day, for the
  once-a-day rule), `monthKey` and `warsawDay` (computed once at insert, never recomputed). Weeks start Monday in Warsaw, built from
  `warsawDay` with the existing `mondayOf`/`addDays` helpers.
- **Rationale**: storing the derived month makes month queries a plain index lookup and guarantees a view never moves months if a rule changes.
  `watch hours` come from `WatchSession.seconds` whose `day` is a calendar date; a day belongs to the month its date falls in (documented
  approximation: a learner-day label, not an instant).
- **Alternatives considered**: computing the month at query time from `countedAt` (works, but any future change to month logic would silently move
  history).

## 5. Money

- **Decision**: all cents are JS integers; the split uses `BigInt` for `pool * views` because that product can exceed 2^53. `net = max(0,
  gross - vat - fees - refunds + adjustments)`; `pool = floor(net * 80 / 100)`; Instik gets `net - pool` (so an odd cent goes to Instik, never above
  the pool). Shares: `base = floor(pool * views / total)`, remainder cents given one each by largest fractional remainder, ties to the creator who
  joined earlier, then by id. Percentages shown to one decimal for display only.
- **Rationale**: deterministic, documented (XII), shares add up to exactly the pool when at least one creator has views.
- **Alternatives considered**: `Math.round` per creator (can exceed the pool); decimal libraries (new dependency, no need).

## 6. Revenue source

- **Decision**: `RevenueSource` has one method, `getMonthRevenue(month)`, returning `{ month, currency, grossCents, vatCents, feesCents,
  refundsCents, source } | null`. `ManualRevenueSource` reads `MonthlyRevenue`, which the owner edits through the service (validated, versioned,
  refused once the month is closed). A future gateway fills the same row or implements the same method; `computeStatement` takes the figures,
  not the source.
- **Rationale**: the spec's gateway independence, tested by computing one statement from two sources.

## 7. Closing and locking

- **Decision**: `closeMonth(month)` locks the `EarningsMonth` row (`SELECT ... FOR UPDATE`), refuses when the month has not ended in Warsaw or has no
  revenue, returns the existing result if already closed (idempotent), otherwise computes the statement and stores the totals and one
  `CreatorEarning` row per creator with counted views (name snapshot). A database trigger refuses updates to a closed month's revenue,
  adjustments and earnings rows as a second line of defence. Adjustments for a closed month are entered in the open month.
- **Rationale**: XII ("a closed month is never changed") enforced twice; two owners closing at once cannot duplicate.

## 8. Payouts

- **Decision**: `Payout` rows are `PAID` or `REVERSAL`, append-only (trigger refuses update and delete). A creator-month is paid when
  `sum(PAID) - sum(REVERSAL) = earnings`. Marking paid locks that `CreatorEarning` row, refuses if already paid or earnings are zero, and stores
  the amount from the closed statement, never from input. A mistake is fixed by a reversal, after which it can be marked again.
- **Rationale**: XII wording; the amount cannot be typed in wrongly.

## 9. Concurrent revenue edits

- **Decision**: `MonthlyRevenue.version` is compared on save; a stale save returns "figures changed, reload". Every save also appends a
  `RevenueChange` row (who, when, the four figures).
- **Rationale**: the spec's two-owners edge case; same idea as spec 10's segment `revision`.

## 10. Dashboard queries and caching

- **Decision**: the service authorises (`actor.role === creator`, scope `actor.id`) and then calls a `use cache` function
  `readCreatorDashboard(creatorId, monthKey, nowMinute)` with `cacheLife({ revalidate: 60, expire: 300 })` and `cacheTag("creator-stats:" + creatorId, "creator-requests")`.
  The cached reader is a **dependency of the service** (`createEarningsService({ store, revenue, now, readDashboard })`), imported only by
  `src/lib/earnings/instance.ts`, which wires the real one; nothing else may import it, so no code can ask for another creator's dashboard by id.
  Tests pass a plain function that reads the in-memory store, so unit tests never need `next/cache`.
  Owner actions that change what a creator sees (revenue saved, month closed, payout marked or reversed, request posted) call `updateTag` for the
  affected tags. Inputs to the cached function are plain strings, never session data.
- **Queries (all indexed; at most ten, run together)**: (1) video counts by status; (2) counted views by `warsawDay` over the last five weeks (also gives
  the month total); (3) distinct learners this month; (4) watch seconds for the creator's videos this month (one raw query joining `Video` and
  `WatchSession` on language and slug); (5) completion from `VideoProgress`; (6) counted views per video this month for the top five; (7) answers per
  video for those five; (8) the month's counted views per creator (an aggregate used only inside the service to compute this creator's share; never
  returned); (9) the month's revenue figures and adjustments; (10) last month's closed earning and payout state for this creator. All but (8) and (9)
  are scoped to this creator; the result type has no field for other creators, the pool or total views.
- **Rationale**: the Next docs say to read runtime data outside cached scopes and pass it as arguments; keys then separate creators by construction.
- **Alternatives considered**: no cache (acceptable at current scale, but the brief asks for caching and the dashboard is read often); `use cache: private`
  (meant for rare compliance cases).

## 11. Average completion and فاهم؟ answers

- **Decision**: completion for a video is the mean of `min(1, positionSeconds / durationSeconds)` over `VideoProgress` rows of learners who watched it this
  month (`watched = true` counts as 1); the dashboard tile averages the creator's videos that at least one learner watched this month (videos nobody watched this month are left out; the tile caption says "Across videos watched this month"). Answers come from
  `ComprehensionAnswer` grouped by answer for that video; the bar shows the three proportions and a text label.
- **Rationale**: uses existing data with no new tracking; "not yet" heavy bars map to the design's guidance text.

## 12. Own videos and creators who are learners

- **Decision**: `countsAsView` refuses when the learner is the creator of the video (host user id). Paused creators still earn from live videos.
- **Rationale**: the spec's assumption; keeps the pool honest without extra rules.

## 13. Content requests

- **Decision**: `ContentRequest` (stage, topic, text up to 200 characters, open or closed, who, when). Owners create, edit and close; creators read open
  requests, newest first, capped at 20 (the list ends); learners never read them.
- **Rationale**: the spec's FR-016/017 with the brand rule that lists end.

## 14. Design gap

- **Decision**: build the revenue form, Access page and Requests page from the existing owner components and tokens, and add them to
  `docs/design/` as a follow-up task (constitution VI).
