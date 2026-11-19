# Approved MVP screens

These files are the approved designs from the Instik — MVP screens canvas, one file per screen. They are design references, not production code: each file is HTML with inline styles plus a small `DCLogic` class used by the design tool for interactive states (`{{ ... }}` holes, `<sc-for>`, `<sc-if>`). Rebuild them as React components with Tailwind and the tokens in `../design-tokens.json`; match layout, spacing, colours, type and copy.

| File | Screen |
| --- | --- |
| Landing.dc.html | Landing page |
| Onboarding.dc.html | Onboarding (4 steps in one file) |
| Library.dc.html | Library |
| Player.dc.html | Video player + interactive transcript |
| Done.dc.html | Done for today |
| Progress.dc.html | Hours, roadmap and rhythm |
| Host.dc.html | Host page |
| Pricing.dc.html | Pricing |

Sample content (host names, video titles, Arabic lines) and bracketed placeholders ([PRICE], [~X hours]) are not final.

## Creator and owner panels (added November 2026)

| File | Screen |
| --- | --- |
| CreatorDashboard.dc.html | Creator: dashboard |
| CreatorUpload.dc.html | Creator: upload a video |
| CreatorVideos.dc.html | Creator: my videos |
| CreatorVideo.dc.html | Creator: video status and history |
| OwnerReviewQueue.dc.html | Owner: review queue |
| OwnerReview.dc.html | Owner: review and transcript |
| OwnerCreators.dc.html | Owner: creators and invites |
| OwnerEarnings.dc.html | Owner: monthly earnings |

All names and numbers on these screens are sample data.

## Built without a design (constitution VI)

Owner-only utility screens (forms, lists and settings used only by the Instik team) may be built from the approved owner components and the design
tokens without a separate design, and are recorded here afterwards. They still follow the tokens, contrast, 44px targets, keyboard and motion rules.
Learner and creator screens always need an approved design first.

| Screen | Route | Spec | Notes |
| --- | --- | --- | --- |
| Earnings additions: revenue form, adjustments, close month, mark as paid, payment history | `/owner/earnings` | 11 | Added to the approved `OwnerEarnings.dc.html` statement |
| Full access: give or remove Full access by hand, active grants and history | `/owner/access` | 11 | No design yet |
| Requests: write, edit and close the content requests creators see | `/owner/requests` | 11 | No design yet; the creator side follows `CreatorDashboard.dc.html` ("What learners need next") |

These could be added to the design files when the canvas is next updated.
