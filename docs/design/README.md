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
