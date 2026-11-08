# Quickstart: Honest Hours

How to prove the feature works end to end. Models, rules and actions are in [data-model.md](data-model.md) and [contracts/](contracts/).

## Prerequisites

1. The environment from spec 4: a Neon development branch, Google and Resend variables in `.env.local`.
2. At least one video with a playable source (the sample clip is enough) and a signed-in test learner with an Egyptian Arabic profile.
3. Two browsers or one normal and one private window signed in as the same learner (scenario 4).

## Set up

```text
npm install
npx prisma migrate dev          # adds the hours tables and columns
npm run dev
```

## Automated checks

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all pass. The tests that matter most:
- `hours-counting.test.ts`: pause, buffering, seek, hidden tab, consecutive repeat, playback rate, long gap, per-tick cap, remainder carry.
- `hours-heartbeat.test.ts`: clamp to the window, future and over-age refusal, watermark cut, two tabs counted once, retried `seq`.
- `hours-day-bucketing.test.ts`: midnight split and day assignment in UTC, Cairo, Kolkata, Kiritimati, Pago Pago, St. John's and London across DST changes.
- `hours-rhythm.test.ts`, `hours-stages.test.ts`, `hours-done-rule.test.ts`, `hours-progress-rules.test.ts`, `hours-manual-time.test.ts`, `languages.roadmap.test.ts`.
- Component tests: `WatchTracker`, `HoursPill`, `AddTimeForm`, `SessionSettings`, `RhythmGrid`.

## Manual scenarios (real browser, clean console)

Use the Network panel to watch the `recordHeartbeat` calls and the database (or the Roadmap) for totals.

1. **Only real watching counts** (Story 1): play 60 s with the tab visible, pause 60 s, play 30 s with the tab in the background (switch tabs), then return, seek back and replay the same second repeatedly. Expected: about 60 s added, heartbeats roughly every 15 s of playing, none while paused or hidden, none for the repeats; the header pill moves within one heartbeat.
2. **Seek and buffering**: seek ahead and back with the controls; throttle the network so the video buffers. Expected: nothing is added for the jumps or the buffering.
3. **Close and return** (edge): play 20 s, close the tab. Reopen the video. Expected: the total includes the beats already sent (at most the last 15 s is missing); nothing doubled; the video resumes near where you stopped.
4. **Two tabs at once** (edge, clarification): play two different videos in two tabs for 60 s. Expected: about 60 s added in total, not 120.
5. **Offline** (edge): in DevTools go offline while playing for 40 s, then back online. Expected: beats retry, appear once each, and the total matches what actually played.
6. **Languages stay apart** (Story 1, 8): with a second available language, watch in one; only its pill and Roadmap change.
7. **Header and Roadmap** (Story 2): a new learner sees zero hours and a kind message. A learner with hours sees the ring text (for example `12h 40m`), stages marked Done / You are here / Next / Later, the bar, and "About N more hours to <next stage> (an estimate)". Remove `roadmap` from the language data (temporarily) and confirm the line disappears. Signed out, the header shows no hours. No string says Superbeginner, Beginner, Intermediate or Advanced.
8. **Stage moves forward only** (clarification): lower the placeholder estimate so the learner passes it; the stage advances. Add outside time to pass a threshold, then remove it: the total drops, the stage stays, and no chime plays again.
9. **Add time outside Instik** (Story 3): add 45 min for yesterday. Total grows 45 min; the entry reads "Added by you" and is separate from watched time; yesterday is marked in the rhythm. Try 0, -5, `abc`, tomorrow and a date two years ago: each gives a message beside the field and saves nothing. Remove the entry as its owner.
10. **Rhythm and time zones** (Story 4): watch a few seconds just before and just after local midnight (set the OS clock or use a zone whose midnight is near); each lands on the right day. Change the OS time zone and reload: new time uses the new zone, nothing disappears. Future days in the current week are dashed, never styled as missed. There is no streak or lost-day wording anywhere.
11. **Done for today** (Story 5): set minutes to 10 in the Roadmap settings, watch past 10 minutes mid-video. Expected: nothing interrupts. Let the video end: the Done screen shows today's minutes, videos, the language total, this week's strip, "See your roadmap" and "I have a bit more time". Choose "I have a bit more time": back at the Library; watch another full 10 minutes: the screen returns after that video ends, not before. With the goal not reached, ending a video shows the normal Up next, and Autoplay next stays off by default.
12. **Session settings** (Story 6): change minutes to 30, turn sound on, reload and sign in elsewhere: both persist; reminders are off by default and nothing is ever sent. With sound on, cross a whole hour (seed the database 59 minutes, then watch 2): one soft chime; with sound off, none. Keyboard: switches are labelled, announce on/off, and are at least 44 px high.
13. **Library** (Story 7): watch half of a video, open the Library: the banner shows it and "Keep watching" resumes near the stop. Watch past 90 % of another: its card says "Watched" and it no longer appears in the banner. With nothing unfinished the banner is hidden. Signed out, neither appears.
14. **Accessibility and layout** (FR-019): Tab through the Roadmap and Done pages; focus is visible; at 360 px there is no horizontal scroll; the rhythm has a text alternative. Compare both screens with `docs/design/Progress.dc.html` and `Done.dc.html` at desktop and phone widths.

## Expected end state

- `WatchSession`, `ManualTime`, `VideoProgress` rows exist for the test learner and no one else's.
- Summed `WatchSession.seconds` matches the playing-and-visible time you measured, within 2 seconds per 10 minutes.
- No row has a day in the future, and `User.timeZone` is the zone you tested last.
- `grep -ri "streak\|superbeginner\|intermediate"` over the new learner-facing code finds nothing outside the sentence "No streaks."
