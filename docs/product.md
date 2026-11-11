# Instik — Product brief for the MVP

This is the single source of truth for what we are building. Where it conflicts with older notes, this file wins. Brand rules come from `brand-guide.pdf`; visual rules from `design-system.md` and `design-tokens.json`. The approved screens are in the Instik — MVP screens canvas (exported into `design/`).

## What Instik is

A comprehensible-input video platform for picking up languages. Learners watch levelled videos with real native-speaker hosts, understand almost everything, and see every hour of watching counted toward a roadmap. Built for many languages; the first launch language is **Egyptian Arabic**.

Tagline: "Your scroll time, but it counts."

Audience: adults studying on their own, English interface. Not for children, exam prep or grammar drills.

## MVP screens (approved designs)

1. **Landing page**: hero, three pillars (Real people, At your level, Counted), how it works, four roadmap stages, waitlist for other languages, "Is this AI?" answer, final call to action.
2. **Onboarding**: choose a language (Egyptian Arabic available; others show "Join the waitlist"), self-pick level (an optional listening check, never forced), choose usual minutes per day, create an account (Google or email magic link).
3. **Library**: "pick up where you left off", stage and topic filters, search, video cards. The list ends. No infinite scroll.
4. **Video player + interactive transcript**: the video with slow speed and back-5-seconds; transcript synced to playback; toggles for Arabic script, tashkeel, transliteration and English (the choice is remembered); tap a word for its meaning, transliteration and audio; host card; the optional فاهم؟ check (no score); Up next with autoplay OFF by default.
5. **Done for today**: shown when the learner reaches their usual minutes. Today's minutes, total hours, this week's rhythm, "See your roadmap", and a quiet "I have a bit more time".
6. **Hours, roadmap and rhythm**: the total hours counter, four stages with the current position, an 8-week rhythm calendar of days watched, add time outside Instik, session settings (minutes per day, reminders off by default, optional sound when an hour is added).
7. **Host page**: photo, name in Latin and Arabic, short story, topics, videos with this host.
8. **Pricing**: Free and Full access, monthly or yearly, FAQ. Prices are placeholders until decided.

The MVP started without any admin panel (content as files). That changed in November 2026: before production, Instik adds a **creator programme** with a creator panel and an owner panel (screens 9–16 below).

### Creator panel (invite only)

9. **Dashboard**: videos uploaded, in review, approved and with changes requested; this month's counted views, watch hours, unique learners and average completion; views per week; earnings (estimated this month, last month final, next payout); top videos with their فاهم؟ answers; requests from Instik.
10. **Upload a video**: direct upload with progress, title, stage, topic, language, description and a pre-submit checklist. Creators do not write transcripts.
11. **My videos**: every video with its status, latest note from Instik and views.
12. **Video status**: the note from Instik, the full status history, upload a new version.

### Owner panel (Instik)

13. **Review queue**: oldest first, with counts.
14. **Review and transcript**: player, review checklist, stage and access (free or full) set by Instik, the transcript editor, and Reject / Request changes / Approve and publish. A note is required for reject and changes; approve needs the full checklist.
15. **Creators**: invite by email (one-time link, expires after 7 days), pause and resume, per-creator stats.
16. **Earnings**: monthly statement from gross revenue to net, the 80/20 split, each creator's share, mark as paid, close the month.

## Brand behaviours the product must enforce

- No infinite scroll. Lists end. Sessions end with "Done for today".
- Honest hours: only time with a video actually playing and the tab visible counts.
- No streaks. A rhythm view of days watched, with nothing to lose.
- No tests by default. The level check is optional.
- Every video shows its host.
- Notifications are rare, kind and off by default.
- Autoplay-next is off by default.
- Copy follows the voice in the brand guide: short, warm, honest, never shaming. Hour thresholds are always "estimates".

## Learner-facing terms

Hours, Roadmap, Hosts, Up next, Done for today. Stages: Hear it → Follow it → Understand it → Join in. Internal content levels (Superbeginner, Beginner, Intermediate, Advanced) never appear in learner copy. Launch content covers Hear it and Follow it.

## Content model

- Video files never pass through our server. The browser uploads them directly to Mux using a one-time upload link created by our server; Mux tells us through a verified webhook when the video is ready.
- The database stores everything about a video except the file: title, slug, language, variety, stage, topic, creator, duration, access (free or full, set by Instik), Mux asset and playback IDs, status, transcript segments and glossary links.
- Video status follows one path: Draft → Uploading → Processing → In review → Approved (live). From review it can go to Changes requested (back to the creator) or Rejected. Every change is stored with who, when and the note.
- Learners only ever see Approved videos.
- Full-access videos use Mux signed playback; free videos may be public.
- Transcripts are written by Instik in the review screen: time-coded segments with Arabic (with tashkeel), transliteration and English, plus word links to a per-language glossary.
- A creator's profile is their public host page.
- Languages stay as data in `content/languages.json`. The original sample videos, transcripts, glossary and hosts are imported once into the database.

## Roles

- **Learner**: everyone with an account.
- **Creator**: invite only. Upload and manage their own videos, see their own stats and earnings, never anyone else's.
- **Owner**: Instik team. Review, write transcripts, invite and pause creators, run monthly earnings.

## Creator earnings

- Each month, **80% of net revenue** goes to the creator pool and **20%** to Instik. Net revenue = subscription revenue minus VAT, payment fees and refunds.
- The pool is split by each creator's share of **counted views** that month.
- A **counted view**: at least 30 seconds of honest watch time (the same rules as Hours), at most once per learner per video per day, and only from learners with active full access at that time.
- During the month the dashboard shows an estimate. The owner closes the month, which locks the numbers. Money is stored in integer cents, and rounding never makes the shares add up to more than the pool.
- Payouts are bank transfers made by the owner, then marked as paid. Automatic payouts (e.g. Stripe Connect) come later.

## Multi-language and Arabic rules

- Every learner-facing record belongs to a language. Progress, level, hours and rhythm are tracked per language.
- URLs include the language: `/learn/arabic-egyptian/...`.
- The interface is English and left-to-right. Every target-language block carries its own `dir` and `lang` (for Egyptian Arabic: `dir="rtl"`, `lang="arz"`).
- Arabic text is stored with tashkeel; search and word matching strip tashkeel and normalise letter variants (أ/إ/ا).
- Fonts: Nunito (headlines), Inter (body/UI), IBM Plex Sans Arabic (Arabic UI), Noto Naskh Arabic (transcripts). Arabic sets about 1.4× the Latin size with tall line height.

## Stack

- Next.js (App Router) + React + TypeScript, one app, no separate Express server.
- Tailwind CSS, themed from `design-tokens.json`.
- PostgreSQL + Prisma.
- Auth.js: Google and email magic link.
- Mux or Cloudflare Stream for video.
- Stripe (or Paddle as merchant of record) for subscriptions.
- Vercel + managed Postgres for hosting.

## Still to decide (use placeholders until then)

Prices and the free/full split; transliteration standard; provisional roadmap hour estimates; video host choice (Mux vs Cloudflare Stream); payment provider.
