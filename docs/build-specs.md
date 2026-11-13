# Instik — MVP build specs

All specs in build order, each with the two messages you paste into Claude Code. Keep this file at `docs/build-specs.md`.

**For every spec:** `/speckit.specify` (message A) → `/speckit.clarify` → `/speckit.plan` (message B) → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement` → check it in the browser → `git commit` → `/clear`.

| # | Spec | Status | Decide before starting |
| --- | --- | --- | --- |
| 1 | Foundation | Done | — |
| 2 | Content and library | Done | — |
| 3 | Video player and interactive transcript | Done | — |
| 4 | Accounts and onboarding | Done | — |
| 5 | Honest hours, roadmap, rhythm, Done for today | Done | — |
| 6 | Landing, pricing, waitlist, About | Done | — |
| 7 | Payments and access | In progress | Prices, free vs full split |
| 8 | Roles, invites and content in the database | | Your owner email |
| 9 | Creator upload (Mux direct upload) | Built, needs the migration applied and a manual check with real Mux and Blob | Mux access token and webhook secret, Vercel Blob token, webhook tunnel for local testing |
| 10 | Owner review, transcripts and creators | | Verified Resend domain for emails to creators |
| 11 | Creator dashboard and earnings | | Stripe Tax set up (for net revenue) |
| 12 | Automatic payouts (later) | Later | Stripe Connect, legal and tax advice |

**Before spec 8:** update the constitution (message at the end of this file).

---

## Spec 1 — Foundation (done)

Shell, design tokens, fonts, languages as data, Arabic RTL display, placeholder pages.

## Spec 2 — Content and library (done)

Content files with schemas, sample content, Library screen, host pages.

---

## Spec 3 — Video player and interactive transcript

**A. Specify**

```
/speckit.specify Spec 3: the video player and interactive transcript. Read docs/product.md and docs/design/Player.dc.html first.

- Each video has its own player page under /learn/<language-slug>/watch/<video-slug>, reached from the library cards and host pages.
- Video playback with play/pause, back 5 seconds, slower speeds (0.75× and 0.9×) and full screen. The stage badge shows on the video.
- An interactive transcript beside the video (below it on phones), built from the video's .vtt file: the current line is highlighted and follows playback, and clicking a line jumps the video to it.
- Transcript layer toggles: Arabic script, tashkeel, transliteration and English. The learner's choice is remembered on this device for now.
- Tapping a word opens its glossary entry: the word, transliteration, meaning and a "hear it" button when audio exists. Words without an entry are not tappable.
- A host card under the video linking to the host page.
- The optional فاهم؟ check at the end of a video ("Mostly", "Some of it", "Not yet"), no score, stored on this device for now.
- Up next: two or three videos at the same stage, autoplay off by default with a visible switch, and the list ends with "That's all for Up next" and a link to Done for today.

Out of scope: accounts, saving anything to a server, hours tracking.
```

**B. Plan**

```
/speckit.plan Use Mux for video with @mux/mux-player-react; until real uploads exist, use placeholder playback IDs from the content files and show a friendly placeholder when an ID is missing. Parse .vtt with a small typed parser and unit-test the time-to-line lookup. Store transcript toggles and فاهم؟ answers in localStorage behind a hook that reads only after mount, so there are no hydration mismatches. Keep the page a Server Component and make only the player, transcript and toggles client components. Arabic lines use TargetText.
```

---

## Spec 4 — Accounts and onboarding

**A. Specify**

```
/speckit.specify Spec 4: accounts and onboarding. Read docs/product.md and docs/design/Onboarding.dc.html first.

- Visitors can browse the landing page, library and host pages without an account. Watching a video and saving progress require a free account.
- Sign in with Google or with an email magic link (no passwords). Sign out from the account button.
- Onboarding in four steps matching the design: choose a language (unavailable languages show "Join the waitlist"), say how much you know (self-pick; the listening check is shown as optional and can be a placeholder), choose usual minutes per day (10, 20, 30, 60), then create the account. Choices made before signing up are kept after sign-up.
- Each learner has a separate profile per language: stage and minutes per day. A learner can add another language later.
- Transcript toggles and فاهم؟ answers move from this-device storage to the learner's account, keeping any choices already made on the device.
- The account button opens a small menu: settings, sign out.

Out of scope: hours tracking, payments, real level test.
```

**B. Plan**

```
/speckit.plan Add PostgreSQL with Prisma (managed host such as Neon) and Auth.js with the Prisma adapter, Google provider and email magic links (Resend). Models: User, Account, Session, VerificationToken, LearnerLanguage (user, language code, stage, minutesPerDay), Preference (transcript layers), ComprehensionAnswer. Protect the watch route in middleware and redirect to onboarding with a return URL. Keep secrets in environment variables with a typed env check, and add .env.example. Write tests for the onboarding state carry-over and the per-language profile rules.
```

---

## Spec 5 — Honest hours, roadmap, rhythm and Done for today

**A. Specify**

```
/speckit.specify Spec 5: honest hours. Read docs/product.md, docs/design/Progress.dc.html and docs/design/Done.dc.html first.

- Watch time counts only while a video is actually playing and the tab is visible. Seeking, pausing, muted background tabs and replaying the same second twice in a row don't add time.
- Hours are tracked per language and shown in the header Hours pill (replacing the dash) and on the Roadmap page.
- Learners can add time spent outside Instik (minutes and a date), clearly labelled as added by them.
- The Roadmap page matches the design: total hours with the progress ring, the four stages with the current position, and "about X more hours" shown as an estimate. Stage estimates come from the language data.
- The rhythm view shows the last 8 weeks of days watched, in the learner's time zone. No streaks, nothing to lose.
- When today's watching reaches the learner's minutes per day, the Done for today screen appears after the current video ends (never mid-video), with today's minutes, total hours, this week's rhythm, "See your roadmap" and "I have a bit more time".
- Session settings: minutes per day, reminders (off by default; no sending yet), and an optional soft sound when an hour is added.
- The library's "pick up where you left off" banner and "Watched" labels use real data.

Out of scope: reminders actually being sent, payments.
```

**B. Plan**

```
/speckit.plan Track watch time on the client from the player's timeupdate/playing events plus document.visibilityState, batch it into heartbeats every 15 seconds to a server action that validates and caps each heartbeat at its elapsed time. Models: WatchSession (user, video, language, seconds, day), ManualTime, VideoProgress (last position, watched). Compute totals and rhythm on the server with the learner's IANA time zone. Add stage hour estimates to content/languages.json as clearly marked placeholders. Unit-test the counting rules (pause, seek, hidden tab, cap) and the day bucketing across time zones.
```

---

## Spec 6 — Landing, pricing, waitlist and About

**A. Specify**

```
/speckit.specify Spec 6: marketing pages. Read docs/product.md, docs/brand-guide.pdf, docs/design/Landing.dc.html and docs/design/Pricing.dc.html first.

- The landing page matches the design: hero with the tagline, the three pillars, how it works, the four stages with estimate placeholders, the waitlist, the "Is this AI?" answer and the final call to action. Calls to action go to onboarding (or the library if signed in).
- The waitlist saves a language and an email, confirms kindly, and ignores duplicates. It is also used by onboarding's "Join the waitlist".
- The pricing page matches the design with Free and Full access, a monthly/yearly switch, placeholder prices and the FAQ. Buttons go to onboarding for now.
- An About page with the pronunciation (in-STICK), the method in plain words and the hosts promise; a simple Privacy page placeholder.
- Good sharing and search basics: page titles, descriptions and a social share image in the brand style.

Out of scope: real payments, emailing the waitlist.
```

**B. Plan**

```
/speckit.plan Build these as Server Components with static rendering where possible. Waitlist model (email, language, createdAt, unique on email+language) behind a validated server action with basic rate limiting. Use the Next.js metadata API and an OG image route in the brand colours. Copy must follow the brand voice; prices stay as [PRICE] placeholders from one config file.
```

---

## Spec 7 — Payments and access

**A. Specify**

```
/speckit.specify Spec 7: payments and access. Read docs/product.md and docs/design/Pricing.dc.html first.

- Each video is free or full access (from its content file). Free learners can watch free videos; full-access videos show a calm locked state on cards and the player with a link to pricing, never a pop-up wall.
- Learners can subscribe monthly or yearly from the pricing page and manage or cancel their subscription from account settings. Cancelling keeps access until the end of the paid period, and hours are never lost.
- Access updates as soon as payment succeeds or a subscription ends.
- Prices come from one config, matching the pricing page.

Out of scope: discounts, gift cards, team plans.
```

**B. Plan**

```
/speckit.plan Use Stripe Checkout for subscriptions, the Stripe Customer Portal for managing them, and a verified webhook route that updates a Subscription model (user, status, plan, currentPeriodEnd). Enable Stripe Tax for EU VAT. Check access on the server for every protected video. Test the access rules (free, active, past due, cancelled before period end) and webhook signature verification. Use Stripe test mode keys only until launch.
```

---

## Spec 8 — Roles, invites and content in the database

**A. Specify**

```
/speckit.specify Spec 8: roles, creator invites and moving content into the database. Read docs/product.md (Content model, Roles, Creator panel, Owner panel) first.

- Three roles: learner (every account), creator (invite only) and owner (the Instik team). Owners are set from a configured list of owner emails.
- Owners can invite a creator by name and email. The invite is a one-time link that expires after 7 days. Accepting it turns the account into a creator and creates their creator profile, which is their public host page.
- Videos, hosts, transcripts and the glossary move from files into the database. Languages stay in content/languages.json. A one-time import moves all existing sample content in, can be run twice safely, and reports anything it could not import.
- Every video has a status (Draft, Uploading, Processing, In review, Changes requested, Rejected, Approved) and a history of every status change with who made it, when, and the note.
- The learner site works exactly as before but reads from the database, and shows only Approved videos.
- Creator and owner areas exist as empty pages behind their roles: a learner who opens them is turned away, and creators never see each other's data.

Out of scope: uploading, the review screens, dashboards and earnings.
```

**B. Plan**

```
/speckit.plan Prisma models: role on User; CreatorProfile (the host page); CreatorInvite (hashed one-time token, expiry, used at); Video (status enum, stage, topic, language, access, Mux asset and playback IDs, playback policy, duration); VideoStatusEvent (from, to, actor, note, createdAt); TranscriptSegment (order, start, end, Arabic, transliteration, English); GlossaryEntry and segment word links. OWNER_EMAILS env var. Keep the existing content-loading functions' signatures and switch their source to the database, with cache tags revalidated when a video changes status. Import script in scripts/ that is idempotent. All role checks live in the Data Access Layer, with tests for every role and for a creator reading another creator's data.
```

---

## Spec 9 — Creator upload

**A. Specify**

```
/speckit.specify Spec 9: the creator panel and video upload. Read docs/product.md and docs/design/CreatorUpload.dc.html, CreatorVideos.dc.html and CreatorVideo.dc.html first.

- The creator panel layout from the designs, with Dashboard (empty for now), Upload a video, My videos and My host page.
- Upload a video: the file goes straight from the browser to our video host with a visible progress bar; then title, stage, topic, language and description; a pre-submit checklist; Save draft and Submit for review. Creators never write transcripts.
- The video moves through Uploading and Processing automatically, then waits in In review once submitted and ready.
- My videos lists every video with status filters, its latest note from Instik and its views slot.
- The video status page shows the note, the full history, and lets the creator upload a new version when changes are requested, which sends it back to review.
- Creators can edit their host page: photo, name in Latin and Arabic, short story and topics.

Out of scope: the owner review screens, statistics and earnings.
```

**B. Plan**

```
/speckit.plan Use Mux direct uploads: a server action creates the upload (with the site origin as CORS origin and a signed playback policy) only for the signed-in creator, and the browser uploads with the Mux upload component or UpChunk. Add a Mux webhook route that verifies the signature and handles upload and asset events (asset created, ready, errored) to update status and duration; parse event fields with zod. Keep status changes in one pure, tested state machine shared with spec 10. Store host photos in a simple, documented place (e.g. Vercel Blob) with size and type limits. Document the local tunnel needed for Mux webhooks in quickstart.md.
```

---

## Spec 10 — Owner review, transcripts and creators

**Carry over from spec 9** (see specs/009-creator-panel-upload): every owner read of videos must filter `deletedAt` (a creator can soft-delete a draft); extend `canUpload` in `src/lib/creator/can-upload.ts` so a paused creator cannot upload or submit; the owner sets the final `stage`, pre-filled from the creator's `proposedStage`; reuse the one state machine in `src/lib/content/status.ts`.

**A. Specify**

```
/speckit.specify Spec 10: the owner panel. Read docs/product.md and docs/design/OwnerReviewQueue.dc.html, OwnerReview.dc.html and OwnerCreators.dc.html first.

- Review queue, oldest first, with counts for needs review, transcript in progress, waiting on creator and approved this month.
- Review screen: play the video, a review checklist, set the stage and access (free or full), and write the transcript (time-coded segments with Arabic with tashkeel, transliteration and English, import a .vtt, link words to the glossary).
- Actions: Approve and publish (only when the checklist is complete and the transcript exists), Request changes, Reject. A note is required for the last two. Approving makes the video visible to learners right away.
- The creator gets an email for every decision, and sees it in My videos.
- Creators page: invite, resend an invite, pause and resume a creator (a paused creator cannot upload, and their live videos stay up), and per-creator stats.

Out of scope: earnings and the creator dashboard.
```

**B. Plan**

```
/speckit.plan Owner-only routes and server actions, checked in the Data Access Layer. Reuse the spec 9 state machine for every transition, inside a database transaction that also writes the VideoStatusEvent. On approval of a free video, add a public Mux playback ID; full-access videos stay signed. Revalidate the learner pages' cache tags on approve. Transcript editing saves per segment; .vtt import parses into segments with tests. Decision emails through Resend with plain, kind templates. Tests for every transition, the required-note rule and the approve preconditions.
```

---

## Spec 11 — Creator dashboard and earnings

**A. Specify**

```
/speckit.specify Spec 11: creator statistics and monthly earnings. Read docs/product.md (Creator earnings) and docs/design/CreatorDashboard.dc.html and OwnerEarnings.dc.html first.

- Counted views follow product.md exactly: at least 30 seconds of honest watch time, at most once per learner per video per day, only from learners with active full access at that time.
- Creator dashboard as designed: video counts by status; this month's counted views, watch hours, unique learners and average completion; views per week; top videos with their فاهم؟ answers; requests from Instik; and earnings (estimated this month, last month final, next payout date).
- Owners can post content requests that all creators see.
- Owner earnings page: for each month, gross subscription revenue, minus VAT, payment fees and refunds, gives net revenue; 80% goes to the creator pool and 20% to Instik; each creator's share is their share of counted views. The owner closes a month, which locks its numbers, then marks each creator as paid.
- Creators only ever see their own numbers.

Out of scope: automatic payouts.
```

**B. Plan**

```
/speckit.plan Derive CountedView rows (user, video, day, unique) from the existing honest-hours watch data when a learner passes 30 counted seconds on a video in a day and had active access then. Read monthly gross, tax, fees and refunds from Stripe (invoices and balance transactions) into a MonthlyStatement; compute CreatorEarning rows in integer cents with largest-remainder rounding so shares sum exactly to the pool. Closing a month is an owner action that is idempotent and locks the statement. Dashboard queries are per creator and cached briefly. Tests for the counted-view rules, the split and rounding, month closing, and a creator reading another creator's numbers.
```

---

## Constitution update (run once, before spec 8)

```
/speckit.constitution Amend the constitution for the creator programme described in docs/product.md:
- Replace the "content as files, no admin panel" principle: content now lives in the database, published through an upload → review → approve workflow; only Approved videos reach learners; languages stay as data files.
- Add roles and permissions: learner, creator (invite only) and owner. Every permission is checked on the server in the Data Access Layer, and a creator never sees another creator's data.
- Add money rules: amounts in integer cents; creator earnings follow product.md exactly (80% of net revenue, split by counted views); a closed month is never changed; every payout is recorded.
- Video files go directly from the browser to the video host and never through our server.
```
