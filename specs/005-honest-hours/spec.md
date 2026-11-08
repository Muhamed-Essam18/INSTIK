# Feature Specification: Honest Hours

**Feature Branch**: `005-honest-hours`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Spec 5: honest hours. Watch time counts only while a video is actually playing and the tab is visible; seeking, pausing, muted background tabs and replaying the same second twice in a row don't add time. Hours are tracked per language and shown in the header Hours pill and on the Roadmap page. Learners can add time spent outside Instik, clearly labelled. The Roadmap page matches the design (`docs/design/Progress.dc.html`): total hours with ring, four stages with current position, 'about X more hours' as an estimate from language data. Rhythm view of the last 8 weeks in the learner's time zone, no streaks. Done for today screen (`docs/design/Done.dc.html`) after the current video ends once today's minutes reach the learner's minutes per day. Session settings: minutes per day, reminders (off by default, no sending), optional soft sound when an hour is added. Library 'pick up where you left off' and 'Watched' labels use real data. Out of scope: reminders being sent, payments."

## Clarifications

### Session 2026-11-08

- Q: After "I have a bit more time", when should Done for today appear again that day? → A: After each further full goal-sized block of watching, once the current video ends.
- Q: When does a video count as "Watched"? → A: When the learner reaches the last 10% of the video or its end.
- Q: If two devices or tabs play at once, how do hours count? → A: Each real moment counts once; overlapping playback is not added twice.
- Q: How is the learner's current Roadmap stage decided? → A: They start at the stage chosen in onboarding; their hours move them to a later stage only when total hours pass that stage's estimate, and they never move back.
- Q: What happens to the stage and the hour chime if added time is removed? → A: The total updates, but the stage never moves back and a chime that already played never replays.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Only real watching counts (Priority: P1)

A signed-in learner watches a video. Time is added to their hours for that language only while the video is playing and the Instik tab is visible. Pausing, seeking, switching to another tab, or replaying the same second again and again does not inflate the total.

**Why this priority**: Honest hours are the product's core promise. Every other part of this feature displays this number.

**Independent Test**: Play a video for 60 seconds with the tab visible, pause for 60 seconds, play 30 more with the tab hidden, then seek back and replay the same second repeatedly. The total grows by about 60 seconds only.

**Acceptance Scenarios**:

1. **Given** a video playing in a visible tab, **When** time passes, **Then** that time is added to the learner's hours for the video's language.
2. **Given** a paused or buffering video, **When** time passes, **Then** nothing is added.
3. **Given** a playing video, **When** the tab becomes hidden or the window is minimised, **Then** counting stops until the tab is visible and the video is still playing.
4. **Given** a muted video in a background tab, **When** time passes, **Then** nothing is added.
5. **Given** the learner seeks forward or back, **When** the jump happens, **Then** the skipped span adds nothing, and counting resumes from the new position as playback continues.
6. **Given** the same second of the video is played twice in a row, **When** the repeat happens, **Then** the repeated second adds no time.
7. **Given** the learner closes the tab or loses connection mid-video, **When** they return, **Then** time already counted is kept and no time is double counted or invented for the gap.
8. **Given** a learner with two languages, **When** they watch in one, **Then** only that language's hours change.

---

### User Story 2 - See my hours in the header and on the Roadmap (Priority: P1)

The Hours pill in the header shows the learner's total hours for the current language, replacing the dash. The Roadmap page matches the approved design: a progress ring with total hours (for example "12h 40m"), a friendly heading, the four stages (Hear it, Follow it, Understand it, Join in) with the current one marked "You are here", and "About X more hours to the next stage (an estimate)". Stage hour estimates come from the language's data.

**Why this priority**: Seeing the hours is the reward for honest counting.

**Independent Test**: With a learner holding 12h 40m, open the Roadmap and confirm the ring text, the stage states and an estimate worded as an estimate; confirm the header pill shows the same total.

**Acceptance Scenarios**:

1. **Given** a learner with no hours yet, **When** they view the header and Roadmap, **Then** both show zero hours with a kind, non-shaming message.
2. **Given** a learner whose current stage is set by their onboarding pick and later by their hours, **When** the Roadmap loads, **Then** earlier stages read "Done", the current reads "You are here" with a progress bar, later ones read "Next" and "Later" and are dimmed.
3. **Given** the current stage has an hour estimate in the language data, **When** the Roadmap loads, **Then** it shows "About N more hours to <next stage> (an estimate)". Internal level names never appear.
4. **Given** a learner whose hours pass the estimate for their stage, **When** the Roadmap loads, **Then** no negative or "overdue" figure is shown; the copy stays warm and honest.
5. **Given** a language with no estimates in its data, **When** the Roadmap loads, **Then** the "more hours" line is omitted instead of showing a guess.
6. **Given** the learner switches language, **When** the header and Roadmap reload, **Then** they show that language's hours only.
7. **Given** a signed-out visitor, **When** they view the header, **Then** no hours are shown.

---

### User Story 3 - Add time spent outside Instik (Priority: P2)

On the Roadmap page, the learner chooses "Add time outside Instik", enters minutes and a date, and saves. The time counts toward the total for that language and is clearly labelled as added by the learner, separate from watched time.

**Why this priority**: Learners study elsewhere too; the trust model needs this to be transparent, not hidden.

**Independent Test**: Add 45 minutes for yesterday, then confirm the total grows by 45 minutes, the entry is labelled "Added by you", and the day appears in the rhythm view.

**Acceptance Scenarios**:

1. **Given** the add-time form, **When** the learner enters valid minutes and a date and saves, **Then** the total updates and the entry appears labelled "Added by you".
2. **Given** invalid input (zero, negative or non-numeric minutes; a future date; a date implausibly old), **When** they save, **Then** a clear message appears next to the field and nothing is saved.
3. **Given** entries the learner added, **When** they view the list, **Then** each shows date, minutes and the "Added by you" label, and they can remove an entry they added; removing lowers the total but never moves the stage back.
4. **Given** added time, **When** totals are shown, **Then** watched time and added time can be told apart on the Roadmap.
5. **Given** added time on a past date, **When** the rhythm view loads, **Then** that day counts as a day watched for that language.

---

### User Story 4 - Rhythm view with no streaks (Priority: P2)

The Roadmap shows the last 8 weeks as a calendar of days the learner watched, using the learner's own time zone. Days without watching are "rest days". There are no streaks, counts of lost days or warnings.

**Why this priority**: It is the brand's gentle alternative to streaks.

**Independent Test**: Watch on two days and add time on a third; confirm exactly those three days are marked in the right week and column, including when watching crosses midnight in the learner's time zone.

**Acceptance Scenarios**:

1. **Given** the Roadmap, **When** the rhythm loads, **Then** it shows 8 week columns of 7 days, the legend "Watched" and "Rest day", and the line "No streaks. A rest day never costs you anything."
2. **Given** watching just before and after local midnight, **When** the rhythm loads, **Then** each part is on its correct local day.
3. **Given** future days in the current week, **When** shown, **Then** they are visibly not yet reached and not styled as missed.
4. **Given** a learner who missed days, **When** they use any part of the product, **Then** no streak count, loss message or shaming copy appears.
5. **Given** a learner whose time zone changes, **When** the rhythm loads, **Then** days are grouped by their current time zone without losing any watched time.

---

### User Story 5 - Done for today (Priority: P1)

When today's counted watching reaches the learner's minutes per day, the Done for today screen appears after the current video ends, never mid-video. It shows today's minutes, videos watched today, total hours for the language, this week's rhythm, "See your roadmap" and a quiet "I have a bit more time".

**Why this priority**: Every session must end; this is a brand behaviour, not polish.

**Independent Test**: Set minutes per day to 10, watch past 10 minutes mid-video, confirm nothing interrupts, then let the video end and confirm the screen appears with correct figures.

**Acceptance Scenarios**:

1. **Given** today's minutes reach the goal during a video, **When** the video continues, **Then** playback is not interrupted.
2. **Given** the goal has been reached, **When** the current video ends, **Then** the Done for today screen appears showing today's minutes, videos, total hours and this week's rhythm per the design.
3. **Given** the Done screen, **When** the learner chooses "See your roadmap", **Then** they go to the Roadmap.
4. **Given** the Done screen, **When** the learner chooses "I have a bit more time", **Then** they return to the Library, and the screen is not shown again that day until they have watched a further full goal-sized block, and then only after the current video ends; this repeats for each further block.
5. **Given** the goal is not yet reached, **When** a video ends, **Then** the normal Up next experience is shown (autoplay stays off by default).
6. **Given** the learner changes minutes per day, **When** the next video ends, **Then** the new goal applies.
7. **Given** the Done screen, **When** it is shown, **Then** copy is warm and never shaming ("Missed a day? That's fine. Nothing is lost.").

---

### User Story 6 - Session settings (Priority: P3)

On the Roadmap page the learner sets minutes per day, turns reminders on or off (off by default; the choice is stored, nothing is sent), and turns on an optional soft sound when a full hour is added.

**Why this priority**: Completes the design; minutes per day is needed by Done for today.

**Independent Test**: Change minutes to 30, turn sound on, reload, and confirm both stuck; confirm reminders default off.

**Acceptance Scenarios**:

1. **Given** a learner's first visit, **When** settings load, **Then** reminders are off and minutes match what they chose in onboarding.
2. **Given** a change, **When** the learner reloads or signs in on another device, **Then** the choice persists.
3. **Given** sound is on, **When** counted time crosses a whole-hour boundary, **Then** one soft chime plays once. **Given** sound is off, **Then** nothing plays.
4. **Given** reminders are on, **When** time passes, **Then** nothing is sent in this release; the setting is saved only.
5. **Given** keyboard or screen reader use, **Then** toggles are labelled, announce their state, and are at least 44 px high.

---

### User Story 7 - Library uses real progress (Priority: P2)

The Library's "pick up where you left off" banner points to the learner's most recently watched unfinished video, and videos the learner has watched show a "Watched" label, both from real data.

**Why this priority**: Makes the Library feel alive and removes placeholder data.

**Independent Test**: Watch half of a video, return to the Library, and see it in the banner; finish another and see "Watched" on its card.

**Acceptance Scenarios**:

1. **Given** an unfinished video, **When** the learner opens the Library, **Then** the banner shows that video and resumes near where they stopped.
2. **Given** no unfinished video, **When** the Library loads, **Then** the banner is hidden rather than showing a fake item.
3. **Given** a watched video (last 10% or end reached), **When** its card shows, **Then** it carries a "Watched" label; unwatched videos do not.
4. **Given** two languages, **When** the Library loads, **Then** only the current language's progress is used.
5. **Given** a signed-out visitor, **When** the Library loads, **Then** no progress labels or banner appear.

---

### Edge Cases

- Two tabs or devices playing at once (even different videos): each real moment of the day is counted once, so overlapping playback is never added twice.
- Very long unattended playback: counting continues only while playing and visible; no single update adds an implausible span.
- Clock changes or a time zone change mid-session do not create or erase time.
- Learner offline mid-video: counted time is kept and synced when back online without double counting.
- Replaying a video after finishing it: ordinary re-watching later adds time; only consecutive repeats of the same second add nothing.
- Learner removes added time after passing a stage or hearing a chime: the total drops, the stage stays, the chime does not replay.
- Hours past the last stage: the ring and copy stay positive and finite.
- Language removed: that language's hours go with it.
- Display rounding: totals show hours and minutes; sub-minute remainders are carried, not lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add watch time only while the video is playing and the tab is visible.
- **FR-002**: System MUST NOT add time for pauses, buffering, hidden tabs, muted background tabs, or spans skipped by seeking.
- **FR-003**: System MUST NOT add time when the same second of video is played twice in a row.
- **FR-004**: System MUST keep hours, rhythm and daily goal per language, never pooled.
- **FR-005**: System MUST show the learner's total hours for the current language in the header Hours pill, replacing the placeholder dash, for signed-in learners.
- **FR-006**: System MUST let learners add time outside Instik with minutes and a date, validate it, label it "Added by you", and let them remove their own entries.
- **FR-007**: System MUST keep watched time and learner-added time distinguishable.
- **FR-008**: The Roadmap page MUST match `docs/design/Progress.dc.html`: hours ring, heading, four stages with Done / You are here / Next / Later states, rhythm, and session settings.
- **FR-009**: System MUST show "about X more hours" only as an estimate, always saying "estimate"; figures come from the language's data, and the line is omitted if absent.
- **FR-009a**: The current stage MUST start as the stage chosen in onboarding, advance only when total hours for that language pass the current stage's estimate, and never move back.
- **FR-009b**: When a learner removes added time, the total MUST update, but the stage MUST NOT move back and an hour chime that already played MUST NOT replay.
- **FR-010**: Learner copy MUST use stage names (Hear it, Follow it, Understand it, Join in) and never internal level names.
- **FR-011**: Rhythm MUST show the last 8 weeks of days watched, grouped by the learner's time zone, with no streaks, counts of lost days or shaming.
- **FR-012**: System MUST show Done for today after the current video ends when today's counted minutes reach the minutes-per-day goal, never mid-video, per `docs/design/Done.dc.html`.
- **FR-013**: Done for today MUST show today's minutes, videos watched today, total hours for the language, this week's rhythm, "See your roadmap" and "I have a bit more time".
- **FR-014**: System MUST let learners change minutes per day, toggle reminders (default off; stored only) and toggle a soft sound for each added hour (default off).
- **FR-015**: System MUST NOT send any reminder in this release.
- **FR-016**: Library "pick up where you left off" and "Watched" labels MUST come from the learner's real progress for the current language.
- **FR-017**: System MUST preserve counted time across closing, reload and reconnecting, without double counting.
- **FR-018**: Counting rules MUST be isolated and independently testable (constitution principle III).
- **FR-019**: All new screens MUST be accessible: labelled controls, 44 px targets, visible focus, state announced, and safe for RTL and LTR content.

### Key Entities

- **Watch record**: counted seconds for a learner, language and video on a local day.
- **Added time entry**: minutes, date and language, flagged as added by the learner.
- **Daily total**: derived per learner, language and local day; basis of rhythm and Done for today.
- **Session settings**: minutes per day (per language), reminders on/off, sound on/off.
- **Stage estimate**: provisional hour thresholds per stage in the language's data.
- **Video progress**: last position and finished flag per learner and video.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In scripted sessions mixing play, pause, hidden tab, seeking and repeated seconds, the counted total matches true playing-and-visible time within 2 seconds per 10 minutes.
- **SC-002**: A learner sees their updated total in the header within 30 seconds of watching, and on the Roadmap on opening it.
- **SC-003**: A learner can add outside time in under 30 seconds and sees it labelled immediately.
- **SC-004**: 100% of Done for today appearances happen after a video ends, never during playback.
- **SC-005**: No screen shows a streak, loss warning or internal level name.
- **SC-006**: Watching around local midnight lands on the correct day in 100% of tested time zones.
- **SC-007**: The Roadmap and Done screens match their approved designs on review at desktop and phone widths.
- **SC-008**: A learner can resume their unfinished video from the Library in one click.

## Assumptions

- Stage hour estimates are provisional placeholders added to the language data, since `docs/product.md` lists them as still to decide; all copy calls them estimates.
- A video counts as "Watched" once the learner reaches its last 10% or its end, and is then no longer offered under "pick up where you left off".
- Signed-out visitors cannot watch (spec 4), so hours exist only for signed-in learners.
- The learner's time zone comes from their device and is stored with their account.
- The soft sound is one short chime, off by default, played only in the foreground.
- There is no daily viewing limit; the goal only triggers the Done screen.
- Out of scope: sending reminders and payments.
