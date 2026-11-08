# Quickstart: validating Honest Hours

Prerequisites: spec 4 set up (a Neon development branch, `.env.local` from `.env.example`, signed in as a learner with an Egyptian Arabic profile). See [data-model.md](data-model.md) and [contracts/](contracts/) for details.

## Setup

```powershell
npm install
npm run db:migrate      # applies the new models and columns
npm run test            # unit tests, including tests/unit/hours/
npm run typecheck
npm run lint
npm run build           # must pass with no .env.local
npm run dev
```

## 1. Automated checks

`npm run test` passes, including the counting rules, heartbeat cap, day bucketing across time zones, rhythm, stage and goal tests listed in [counting-rules.md](contracts/counting-rules.md). `npm run build` fails on purpose if `content/languages.json` has a `roadmap` block without `provisional`, or with thresholds that do not increase (try it once, then revert).

## 2. Honest counting (spec US1)

1. Open a video, play 60 seconds with the tab visible. Within 15 seconds of pausing, the header pill goes up by about 1 minute.
2. Pause for a minute: the pill does not change.
3. Play, switch to another tab for 30 seconds, come back: nothing was added for the hidden span.
4. Drag the playhead far forward and back: the jump adds nothing.
5. Replay the same second repeatedly (scrub back to it): no growth for the repeated second.
6. Open the same video in two tabs, play both visibly: in a minute, the total grows by about one minute, not two.
7. Reload: the total and your position are kept.
8. Go offline (browser dev tools) and keep watching for 2 minutes, then go online: the total catches up by about 2 minutes. Repeat with 8 minutes offline: only about 5 minutes are added. Replaying the same queue twice (reload during the send) adds nothing the second time.

## 3. Header pill and Roadmap (US2)

- The pill shows `0h 0m` for a new learner and the real total after watching, and switches when you move to another language's pages.
- `/learn/arabic-egyptian/roadmap` matches `docs/design/Progress.dc.html`: the ring with the total, four stage cards (Done, You are here with a bar, Next, Later), and "About N more hours to Understand it (an estimate)". No internal level names appear. A language with no `roadmap` block shows no "more hours" line.

## 4. Added time (US3)

Add 45 minutes dated yesterday: the total rises by 45 minutes, the entry shows "Added by you", and yesterday is marked in the rhythm. Remove it: the total drops; the stage does not move back. Try 0 minutes, 700 minutes, a future date and a date two years back: each shows a clear message and saves nothing.

## 5. Rhythm and time zones (US4)

Change the operating system time zone (or use the browser's sensor override) to Pacific/Auckland, watch for a minute, and confirm the day is the local one. Switch to another zone and confirm earlier days stay where they were and nothing is lost. Confirm future days in the current week look "not yet", never missed, and no streak wording exists anywhere.

## 6. Done for today (US5)

Set "Done for today after" to 10 minutes. Watch past 10 minutes inside a longer video: playback is never interrupted. When the video ends, the Done screen appears with today's minutes, videos, total hours, this week, "See your roadmap" and "I have a bit more time". Choose the latter, watch another video to its end after less than 10 more minutes: no Done screen; after another 10 minutes: it appears again. With Autoplay next on, Done wins over the next video.

## 7. Settings (US6)

Reminders are off on a new account; toggling them stores the choice and sends nothing. Turn the sound on and cross a whole hour (add 59 minutes, then watch 2 minutes): one soft chime, once, never repeated after reload or after removing the added time. Keyboard: toggles are labelled, announce their state, and are at least 44px high.

## 8. Library (US7)

Watch half of a video: the banner shows it with the right time and "Keep watching". Watch to the last 10% of another: its card shows "Watched" and it leaves the banner. Signed out: no banner, no labels. A second language never shows the first language's progress.

## 9. Final gates

`npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` all pass; the Roadmap and Done screens are reviewed against their designs at 1440px and 360px; no console errors or hydration warnings on the watch, roadmap, done and library pages.
