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

No admin panel in the MVP.

### Design decision: utility screens

Utility screens (sign-in, check email, sign-in error, settings with add language, and the account menu) are part of the MVP. They have no separate design and are built from the design system and the patterns in the approved screens.

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

## Content model (no admin panel)

- Videos are uploaded in the video host's dashboard (Mux or Cloudflare Stream).
- Each video's metadata lives as a file in the repository under `content/<language>/videos/<slug>.json`: title, slug, language, variety, stage, topic, host, duration, access (free or full), playback id.
- Each transcript is a file next to it: `<slug>.vtt` (time-synced segments) plus word links into a per-language glossary `content/<language>/glossary.json` (word with tashkeel, base form, transliteration, English meaning, optional audio).
- Hosts: `content/<language>/hosts/<slug>.json` (name, Arabic name, story, topics, photo).
- Languages: `content/languages.json`, each with code, name, variety, script, text direction, fonts and which transcript layers it uses. Adding a language is adding data, not code.
- Learner data (accounts, per-language level, watch sessions, hours, rhythm, settings, transcript preferences, waitlist sign-ups, subscriptions) lives in the database.

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
