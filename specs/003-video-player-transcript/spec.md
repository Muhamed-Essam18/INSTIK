# Feature Specification: Video Player and Interactive Transcript

**Feature Branch**: `003-video-player-transcript`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Spec 3: the video player and interactive transcript. Each video has its own player page; playback controls (play/pause, back 5 seconds, slower speeds, full screen) with the stage badge on the video; an interactive transcript built from the video's .vtt file that follows playback and jumps on click; transcript layer toggles remembered on this device; tap a word for its glossary entry; host card; the optional فاهم؟ check stored on this device; Up next with autoplay off by default. Out of scope: accounts, saving to a server, hours tracking."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch a video with simple controls (Priority: P1)

A learner opens a video from the Library or a host page. They see the player page for that video: the video with the stage badge on it, the title, a line such as "Follow it · 8 min 40 s · Egyptian Arabic", and the playback controls. They can play and pause, go back 5 seconds, slow the video down, and go full screen. A host card under the video shows who is speaking and links to the host page.

**Why this priority**: Watching is the product. Every other part of this page supports it.

**Independent Test**: Open `/learn/arabic-egyptian/watch/at-the-cafe`. Play, pause, go back 5 seconds, switch speeds, enter and leave full screen, then follow the host card. Everything works without any transcript, account or saved data.

**Acceptance Scenarios**:

1. **Given** a video card in the Library or on a host page, **When** the learner activates it, **Then** they land on that video's player page, which shows its title, stage badge on the video, stage, length and language line, and a host card.
2. **Given** the player page, **When** the learner presses play, **Then** the video plays and the control now offers pause; pressing it pauses.
3. **Given** playback at 1:10, **When** the learner presses "Back 5 seconds", **Then** playback moves to 1:05; at 0:03 it moves to 0:00.
4. **Given** the player, **When** the learner picks 0.9× or 0.75×, **Then** the video plays at that speed and the control shows the current speed; they can return to normal speed.
5. **Given** the player, **When** the learner chooses full screen, **Then** the video fills the screen with its controls still usable, and leaving full screen returns to the page.
6. **Given** the host card, **When** the learner activates it, **Then** they go to that host's page.
7. **Given** a video address that does not exist, **When** it is opened, **Then** the learner sees the friendly not-found page.
8. **Given** a video that cannot load, **When** the learner opens the page, **Then** they see a short, kind message and can go back to the Library; the rest of the page still works.

---

### User Story 2 - Follow along in the interactive transcript (Priority: P1)

Beside the video (below it on phones) the learner sees the transcript built from the video's transcript file. The line being spoken is highlighted and stays in view as the video plays. Clicking any line jumps the video to that line.

**Why this priority**: The transcript is what turns watching into understanding; it is the heart of the product's promise.

**Independent Test**: Play a video that has a transcript and watch the highlight move with the speech; click a later line and an earlier line; the video jumps each time.

**Acceptance Scenarios**:

1. **Given** a video with a transcript, **When** playback reaches a line's start time, **Then** that line is highlighted and the previous line is not.
2. **Given** playback is running, **When** the highlighted line is off-screen in the transcript, **Then** the transcript scrolls so it is visible, without moving the whole page.
3. **Given** a transcript, **When** the learner clicks or presses a line, **Then** the video jumps to that line's start time and that line becomes the highlighted one.
4. **Given** playback is paused or stopped between lines, **When** the learner seeks with the video's own controls, **Then** the highlight follows the new position.
5. **Given** a video with no transcript, **When** its page opens, **Then** the transcript area says the transcript is on its way, and nothing else on the page is affected.
6. **Given** a phone-width screen, **When** the page opens, **Then** the transcript is below the video and nothing scrolls sideways.
7. **Given** a learner who has reduced-motion turned on, **When** the highlight moves, **Then** the scrolling is instant rather than animated.

---

### User Story 3 - Choose which transcript layers to show (Priority: P1)

The transcript has four layers the learner can switch on and off: Arabic script, tashkeel, transliteration and English. By default Arabic, tashkeel and transliteration are on and English is off. The learner's choice is remembered on this device, so it is still in place the next time they open any video in the same language.

**Why this priority**: Learners at different stages need different support. Remembered choices stop them having to set this up for every video.

**Independent Test**: Toggle each layer and watch the transcript change; reload the page and open a different video; the choices are the same. In a different browser or device they are not.

**Acceptance Scenarios**:

1. **Given** the default state, **When** the transcript shows, **Then** Arabic script with tashkeel and transliteration are visible and English is hidden.
2. **Given** the layer toggles, **When** the learner switches a layer on or off, **Then** the transcript updates immediately and each toggle shows whether it is on.
3. **Given** Arabic script is on, **When** the learner switches tashkeel off, **Then** the Arabic text shows without its vowel marks; the stored text is not changed and switching tashkeel on brings the marks back.
4. **Given** Arabic script is off, **Then** the tashkeel toggle is clearly unavailable (it has nothing to act on) and the other layers still work.
5. **Given** the learner has changed the layers, **When** they reload or open another video in the same language, **Then** the same choices apply.
6. **Given** this device cannot store preferences (for example private browsing), **When** the learner changes layers, **Then** the choices still work for the current visit and nothing breaks.
7. **Given** all four layers are off, **Then** each line shows only its time and a short hint to switch a layer on.

---

### User Story 4 - Tap a word for its meaning (Priority: P2)

In the Arabic script layer the learner can tap a word that has a glossary entry. A small card opens showing the word, its transliteration and its meaning, plus a "hear it" button when the entry has audio. Words without an entry are plain text and cannot be tapped.

**Why this priority**: It supports understanding word by word, but the page is useful without it.

**Independent Test**: Tap a word with an entry, read the card, close it; confirm a word without an entry is not interactive and a word without audio shows no "hear it" button.

**Acceptance Scenarios**:

1. **Given** a line with a word that has a glossary entry, **When** the learner taps it, **Then** a card opens with the word (with tashkeel), transliteration and English meaning, close to that line.
2. **Given** the card is open and the entry has audio, **When** the learner presses "Hear it", **Then** the word's audio plays, without moving the video's position.
3. **Given** the entry has no audio, **Then** no "hear it" button is shown.
4. **Given** a word with no glossary entry, **Then** it is not styled or announced as tappable and does nothing when tapped.
5. **Given** the card is open, **When** the learner taps elsewhere, presses Escape, or taps the word again, **Then** the card closes; opening another word replaces it.
6. **Given** a keyboard-only learner, **Then** tappable words can be reached, opened and closed with the keyboard, and focus returns to the word when the card closes.
7. **Given** tashkeel is switched off, **Then** words remain tappable and the card still shows the word with its tashkeel.

---

### User Story 5 - Say whether you followed it (Priority: P2)

Below the host card, an optional check asks "فاهم؟ Did you follow this one?" with "Mostly", "Some of it" and "Not yet". It says there is no score and it helps pick what is up next. The answer is kept on this device for that video and can be changed.

**Why this priority**: It feeds later recommendations, but nothing depends on it today and it must never get in the way.

**Independent Test**: Pick each answer, reload, and see the same answer selected; change it; leave it blank and confirm nothing is blocked.

**Acceptance Scenarios**:

1. **Given** a video page, **Then** the check is shown with its three answers and the "No score" note, and no answer is selected.
2. **Given** the check, **When** the learner picks an answer, **Then** it is shown as selected, and picking another changes it.
3. **Given** a saved answer, **When** the learner returns to this video on this device, **Then** the same answer is selected.
4. **Given** the learner never answers, **Then** nothing is blocked, no reminder appears, and no score or total is shown anywhere.
5. **Given** the Arabic "فاهم؟" text, **Then** it is marked as Arabic (right-to-left, Arabic language) and shown in the Arabic interface font.

---

### User Story 6 - Choose what to watch next (Priority: P2)

"Up next" shows two or three other videos at the same stage as this one, each as a card with stage, title, length and host. An "Autoplay next" switch is visible and off by default. The list ends with "That's all for Up next. Pick one when you're ready, or finish for today." with a link to Done for today.

**Why this priority**: It keeps a session moving without a feed, and the visible end supports the product's "lists end" and "Done for today" behaviours.

**Independent Test**: Open a video; see up to three other videos at its stage; flip the autoplay switch; reach the end message and use its link.

**Acceptance Scenarios**:

1. **Given** a video, **Then** Up next shows two or three other videos at the same stage (never the current one), and every card shows its host.
2. **Given** fewer than two other videos at that stage, **Then** Up next shows what exists (possibly one); with none, it shows a kind message and the same end line.
3. **Given** a first visit, **Then** the Autoplay next switch is off and visibly labelled.
4. **Given** the switch is off, **When** the video ends, **Then** nothing starts by itself.
5. **Given** the learner turns the switch on, **When** the video ends, **Then** the first Up next video opens and starts; the choice is remembered on this device.
6. **Given** the end of the list, **Then** it reads "That's all for Up next." with a link to Done for today and no "load more" control.
7. **Given** a card in Up next, **When** the learner activates it, **Then** they go to that video's player page.

---

### Edge Cases

- A video has no transcript: the transcript area shows a gentle "on its way" note; layer toggles are hidden or disabled; the rest of the page works.
- A transcript line has no transliteration or English text: that layer is simply blank for that line without breaking spacing.
- A glossary link in a transcript points to an entry that does not exist: caught when content is built (the build fails), never discovered by a learner.
- The same word appears twice in a line: each occurrence is tappable and opens the same entry.
- Words are followed by punctuation (such as "؟" or "."): punctuation is not part of the tappable word.
- Two lines overlap or leave gaps in time: the highlight shows the latest line that has started, and none before the first line begins.
- Playback runs past the last line: the last line stays highlighted until playback ends.
- The learner changes speed and then seeks: highlight and time stay correct at any speed.
- The learner leaves the page while the word card is open or audio is playing: audio stops and nothing stays open.
- Stored preferences are missing, corrupted or from an older format: defaults apply and the page works.
- The video's play, pause and back controls are used by keyboard: each is a labelled control with visible focus and a target at least 44 pixels high.
- Free versus full access is stored on each video but not enforced in this feature.
- Narrow phone widths: controls wrap, nothing scrolls sideways, the transcript sits below the video.
- Full screen is not supported by the device: the control is hidden or explains it is unavailable.

## Requirements *(mandatory)*

### Functional Requirements

**Player page**

- **FR-001**: Every video MUST have its own player page at the address `/learn/<language-slug>/watch/<video-slug>`, reached from Library cards, host-page cards, Up next cards and the pick-up banner. Unknown videos MUST show the friendly not-found page.
- **FR-002**: The player page MUST match the approved design (`docs/design/Player.dc.html`) in layout, spacing, colours, type and copy, using the shared header and navigation, with the video on the left and the transcript on the right on wide screens and the transcript below the video on phones.
- **FR-003**: The page MUST show the video title, a line of the form "{Stage} · {length} · {Language variety and name}" (for example "Follow it · 8 min 40 s · Egyptian Arabic"), and the stage badge on the video itself.
- **FR-004**: The page MUST show a host card ("Your host", the host's name, a round initial) under the video that links to the host's page. Every video MUST show its host.

**Playback**

- **FR-005**: Learners MUST be able to play and pause, jump back 5 seconds (never before the start), choose a slower speed of 0.9× or 0.75× and return to normal speed, and enter and leave full screen.
- **FR-006**: The player MUST show elapsed and total time ("2:14 / 8:40") and a progress bar, and the learner MUST be able to seek by using the progress bar.
- **FR-007**: The player MUST show a clear play control before playback starts and MUST NOT start playing by itself when the page opens.
- **FR-008**: All player controls MUST be real, labelled controls usable by keyboard and screen reader, with visible focus, at least 44 pixels high, and state changes (playing or paused, speed, full screen) MUST be announced by the control's own label or state.
- **FR-009**: If the video cannot load or play, the page MUST show a short kind message and a link back to the Library, and the rest of the page MUST keep working.

**Interactive transcript**

- **FR-010**: The transcript MUST be built from the video's transcript file. Each line MUST show its start time and its enabled layers.
- **FR-011**: As playback progresses, the line currently being spoken MUST be highlighted and exposed as the current line to assistive technology, and the transcript MUST keep it visible, scrolling only the transcript area (not the page) and moving instantly when the learner prefers reduced motion.
- **FR-012**: Activating a line (click, tap, Enter or Space) MUST jump the video to that line's start time and keep the playing or paused state.
- **FR-013**: The highlight MUST follow seeking by any means and any playback speed.
- **FR-014**: A video without a transcript MUST still show a working player page with a short "transcript is on its way" note.
- **FR-015**: Transcript content for each line MUST include Arabic script (stored with tashkeel), transliteration and English, and each Arabic word that has a glossary entry MUST be linked to it. Content that breaks these rules MUST fail the build with a message naming the file and line, as in the content rules of the Content and Library spec.
- **FR-016**: Each Arabic block in the transcript MUST carry its own right-to-left direction and Arabic language attributes and use the transcript font; transliteration and English MUST be left-to-right.

**Layer toggles**

- **FR-017**: The transcript MUST offer four toggles — Arabic, Tashkeel, Transliteration, English — each showing whether it is on. The defaults are Arabic, Tashkeel and Transliteration on, English off.
- **FR-018**: Turning Tashkeel off MUST hide the vowel marks in the displayed Arabic text without changing stored text; turning it on restores them. When Arabic is off the Tashkeel toggle MUST be shown as unavailable.
- **FR-019**: The learner's layer choices MUST be remembered on this device, separately for each language, and applied to every video in that language. No choice is sent to a server. If the device cannot store them, choices MUST still work for the current visit.
- **FR-020**: When all layers are off, each line MUST show only its time and a short hint to turn a layer on.

**Word entries**

- **FR-021**: In the Arabic layer, each word with a glossary entry MUST be a tappable control; words without an entry MUST NOT be tappable, styled or announced as controls.
- **FR-022**: Opening a word MUST show a card with the word (with tashkeel regardless of the tashkeel toggle), its transliteration and its English meaning, placed close to the line.
- **FR-023**: The card MUST show a "Hear it" button only when the entry has audio; pressing it MUST play the word's audio without changing the video's position and without starting the video.
- **FR-024**: The card MUST close on Escape, on activating the word again, or on tapping outside it; opening another word MUST replace it; closing MUST return focus to the word. The card MUST be labelled for assistive technology (for example "Word: hot").

**Understanding check**

- **FR-025**: The page MUST show the optional فاهم؟ check with the question "Did you follow this one?", the note "No score. It just helps us pick what's up next.", and three answers: "Mostly", "Some of it", "Not yet".
- **FR-026**: The learner's answer MUST be stored on this device for that video and language, MUST be changeable, and MUST NOT be sent to a server. The check MUST never block anything, never show a score, total or streak, and never nag.
- **FR-027**: The Arabic text "فاهم؟" MUST carry right-to-left direction and Arabic language attributes.

**Up next**

- **FR-028**: Up next MUST show two or three videos at the same stage as the current video, never including the current video, each as a card with stage, title, length, host and a link to its player page. If fewer exist, it MUST show those that do, with a kind message when there are none.
- **FR-029**: Up next MUST include a visible, labelled "Autoplay next" switch that is off by default. While off, no video starts by itself when one ends. When on, the first Up next video opens and plays when the current one ends. The learner's choice MUST be remembered on this device.
- **FR-030**: The Up next list MUST end with "That's all for Up next. Pick one when you're ready, or finish for today." with a link to Done for today. There MUST be no infinite scroll, "load more" or auto-appended content.

**Quality**

- **FR-031**: Nothing in this feature may track watch time, count hours, record watch history, create accounts or send learner data to a server.
- **FR-032**: Pages MUST work from phone to desktop widths without sideways scrolling, meet the project's contrast and focus standards, and keep learner copy in the brand voice. Internal level names MUST NOT appear.
- **FR-033**: Reading, writing or failing to read stored preferences MUST NOT cause the page to differ between its first display and the display once it is interactive in a way that the learner can see as a flash of wrong content or that causes the browser to report a mismatch.

### Key Entities

- **Video**: As defined in the Content and Library spec; additionally supplies the stage badge, length and host for this page.
- **Transcript**: Ordered, time-stamped lines for one video. Each line has a start time, an end time, Arabic text with tashkeel, transliteration, English, and word links.
- **Word link / Glossary entry**: A word in a line connected to a glossary entry (word with tashkeel, base form, transliteration, English meaning, optional audio).
- **Transcript layers (preference)**: Which of Arabic, Tashkeel, Transliteration, English are shown; remembered per language on this device.
- **Understanding answer (preference)**: Mostly, Some of it, Not yet, or none, for one video in one language, on this device.
- **Autoplay preference**: On or off, off by default, on this device.
- **Up next list**: Two or three other videos at the same stage as the current video.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can open a video from the Library and have it playing within two actions (open the card, press play).
- **SC-002**: The highlighted transcript line is the correct one within 0.5 seconds of the spoken line at normal speed, at 0.9× and at 0.75×, and after any seek, in 100% of tested positions.
- **SC-003**: Clicking a transcript line moves the video to that line's start time (within 0.25 seconds) in 100% of tested lines.
- **SC-004**: Transcript layer choices and the understanding answer are still in place after a reload and on another video in the same language in 100% of tested cases, and no data leaves the device.
- **SC-005**: Every word with a glossary entry opens the correct card; every word without an entry stays inert, in 100% of tested words.
- **SC-006**: With autoplay left at its default, no video starts by itself after another ends in any tested case.
- **SC-007**: Up next shows no more than three videos, never the current video, and always ends with the closing line and the Done for today link.
- **SC-008**: The page matches the approved design in a side-by-side review at desktop and phone widths, and passes the project's automated accessibility checks with no serious issues.
- **SC-009**: The browser console shows no errors or hydration mismatch on the player page across first load, layer changes, opening a word and the understanding check.
- **SC-010**: A video with no transcript still gives a fully working player page in 100% of tested cases.

## Assumptions

- Sample content has no real video yet, and the video host (Mux or Cloudflare Stream) is still undecided. Playback sits behind a thin interface; for sample content the player uses a clearly marked sample source so that every control can be tried and tested. The real source is wired in when the video host is chosen.
- The transcript files from the Content and Library spec only carry Arabic text, so this feature extends the transcript content so each line also carries transliteration, English and word links to the glossary. The two existing sample transcripts are updated to match, stay clearly marked as sample, and the glossary is extended to cover their words. Validation continues to fail the build on any bad file.
- Tapping a word works in the Arabic script layer only; transliteration and English are not tappable.
- Remembered choices (layers, understanding answers, autoplay) live only in the browser on this device, per language where it matters, and are replaced by account-based storage in a later spec. Clearing browser data clears them.
- The understanding check is shown on the page as in the design rather than appearing only when playback ends; it is optional and unlocked at all times.
- Speed options are 1× (normal), 0.9× and 0.75×; the chosen speed lasts for the current visit only and is not remembered.
- Up next is chosen from other videos at the same stage in library order, starting after the current video and wrapping around. The choice is simple on purpose; smarter picks (using the understanding answer) come later.
- Free versus full access is not enforced; accounts, pricing and access rules come later.
- The pick-up banner on the Library stays static; this feature does not save playback position or watch history.
- The "Hours" pill in the header is left as spec 001 built it; no hours are counted or shown here.
- Done for today is the existing placeholder page.
- Out of scope: accounts, saving anything to a server, hours tracking, watch history, and resuming from a saved position.
- Dependencies: the app shell and tokens (spec 001), content layer, Library, host pages and the `watch/<video>` route (spec 002).
