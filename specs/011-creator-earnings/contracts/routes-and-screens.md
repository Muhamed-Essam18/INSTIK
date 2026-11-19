# Contract: Routes and screens

| Route | Who | Screen | Design |
|---|---|---|---|
| `/creator` | creator | Dashboard (replaces the spec 9 landing; "Upload a video" button stays) | `CreatorDashboard.dc.html` |
| `/owner/earnings` (`?month=YYYY-MM`) | owner | Earnings: month picker, revenue form (open month), statement, creator shares, close month, mark paid | `OwnerEarnings.dc.html` (+ form, adjustments, history: no design yet) |
| `/owner/access` | owner | Full access: grant form, active grants, history | none yet |
| `/owner/requests` | owner | Requests: write, edit, close, list | none yet |

The owner nav (spec 10) gains Earnings, Access and Requests, in that order after Creators and before Learner site (the design shows Earnings; the
other two are additions). Routes live in `src/lib/routes.ts` (`ownerEarningsPath(month?)`, `ownerAccessPath()`, `ownerRequestsPath()`).

## Dashboard sections (creator, top to bottom)

1. Heading "Welcome back, {first name}", the month and language line, "Upload a video".
2. Four tiles: Videos uploaded, In review, Approved, Changes requested (with a link to the note).
3. Four tiles: Counted views, Watch hours, Unique learners, Average completion.
4. Views per week (five bars, current week marked, with a text list alternative) beside the Earnings card.
5. Top videos this month (at most five) with the فاهم؟ bar and its legend.
6. Requests from Instik (open, newest first, at most 20).

## Rules every screen follows

- Reads happen in Server Components behind `Suspense` (cache components); forms and confirmations are the only client components.
- Calm empty states; no ranks, no comparisons, no "overdue"; estimates are labelled "estimated".
- Controls are labelled and at least 44px; tables scroll horizontally on small screens; lists end.
- No learner name, email or id appears on any of these pages.
