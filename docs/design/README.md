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
