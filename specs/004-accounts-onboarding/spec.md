# Feature Specification: Accounts and Onboarding

**Feature Branch**: `004-accounts-onboarding`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Spec 4: accounts and onboarding. Visitors can browse the landing page, library and host pages without an account; watching a video and saving progress require a free account. Sign in with Google or an email magic link (no passwords); sign out from the account button. Four-step onboarding matching the design (language, how much you know, minutes per day, create account); choices made before signing up are kept. A separate profile per language (stage and minutes per day); a learner can add another language later. Transcript toggles and فاهم؟ answers move from this-device storage to the learner's account, keeping choices already made on the device. The account button opens a small menu: settings, sign out. Out of scope: hours tracking, payments, real level test."

## Clarifications

### Session 2026-11-06

- Q: Should videos marked "free" in the content data be watchable without an account, or does every video need a free account? → A: Every video needs a free account, whether marked free or full. Free versus full is left for the payments spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Join through onboarding (Priority: P1)

A new visitor chooses to start. They go through four steps shown in the approved design (`docs/design/Onboarding.dc.html`): pick a language, say how much of it they know, pick how long they usually have each day, and create a free account. After creating the account they land in the Library for that language, with the stage and daily minutes they chose already set.

**Why this priority**: Without an account nobody can watch or save anything. This is the doorway to the whole product.

**Independent Test**: As a signed-out visitor, start onboarding, choose Egyptian Arabic, "Some words and phrases", 30 min, then sign in with an email link. Confirm the learner arrives in the Library and their profile shows "Hear it" and 30 minutes.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open onboarding, **Then** they see "Step 1 of 4", a four-part progress bar with one part filled, and the heading "What do you want to pick up?".
2. **Given** step 1, **When** the list shows languages, **Then** Egyptian Arabic is marked "Available" and can be chosen, and every language that is not available (for example Spanish and "Something else") is shown dimmed with a "Join the waitlist" link and cannot be chosen as a learning language.
3. **Given** step 2, **When** the learner picks one of the four self-description options (None at all; Some words and phrases; I can follow slow, simple talk; I understand a lot of everyday talk), **Then** the option shows as selected, shows the stage it maps to (Hear it, Hear it, Follow it, Understand it), and Continue moves to step 3. Internal level names never appear.
4. **Given** step 2, **When** the learner reads the page, **Then** they see "Try a short listening check. It's optional and there's no score." Following it never blocks Continue, and nothing on the page requires the check.
5. **Given** step 3, **When** the learner picks 10, 20, 30 or 60 minutes, **Then** exactly one is selected (20 is preselected) and Continue moves to step 4.
6. **Given** step 4, **When** the learner sees the page, **Then** they see "Save your hours", "Continue with Google", an email field, the line "We'll send you a sign-in link. No password to remember.", and no password field.
7. **Given** any step after the first, **When** the learner presses Back, **Then** they return to the previous step with their earlier choice still selected.
8. **Given** any step, **When** the learner uses only a keyboard or a screen reader, **Then** every option is a labelled radio-style control with a visible focus and at least 44 pixels high, and the current step is announced.
9. **Given** a learner who finishes onboarding, **When** their account is created, **Then** they land in the Library for the language they chose, and their profile holds the stage and minutes per day they picked.

---

### User Story 2 - Sign in, and sign out (Priority: P1)

A returning learner signs in with Google or with an email link and is taken back to where they were going. They can sign out from the account button at any time. There are no passwords anywhere.

**Why this priority**: Every returning visit depends on signing in; signing out is a basic trust and privacy need on shared devices.

**Independent Test**: Sign in with an email link from a fresh browser, confirm the account button appears, sign out, confirm the button is replaced by a sign-in option and watching is blocked again.

**Acceptance Scenarios**:

1. **Given** the sign-in page, **When** the learner chooses "Continue with Google" and approves, **Then** they are signed in and sent to the page they were trying to reach, or the Library if none.
2. **Given** the sign-in page, **When** the learner enters an email address and submits, **Then** they are told to check their inbox, and the email contains a single-use link that signs them in when opened on the same or another device.
3. **Given** a sign-in link, **When** it is used a second time or after it has expired, **Then** the learner sees a short, kind message and a way to ask for a new link; they are not signed in.
4. **Given** an email address that has never been seen before, **When** its sign-in link is used, **Then** an account is created and the learner is sent through onboarding if they have no language profile yet.
5. **Given** a Google account and an email link that use the same email address, **When** the learner uses both over time, **Then** they reach the same single account.
6. **Given** an invalid email address, **When** the learner submits, **Then** a clear message appears next to the field and no email is sent.
7. **Given** a signed-in learner, **When** they choose "Sign out" in the account menu, **Then** they are signed out, returned to the landing page, and can no longer watch videos or reach settings until they sign in again.
8. **Given** Google sign-in is cancelled or fails, **When** the learner is returned to the app, **Then** they see a short message and can try again or use an email link.

---

### User Story 3 - Browse freely, sign in to watch (Priority: P1)

Anyone can look around. The landing page, the Library and the host pages work without an account. The moment someone tries to watch a video, they are asked to create a free account, and after signing in they arrive at the video they wanted.

**Why this priority**: Browsing builds trust and lets people see what the product is before committing; the account gate is how progress will be saved.

**Independent Test**: Signed out, open the landing page, Library and a host page, then open a video. Confirm browsing works and the video asks for an account; sign in and confirm the video opens.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open the landing page, the Library, a host page or the pricing page, **Then** each shows its normal content with no sign-in required.
2. **Given** a signed-out visitor, **When** they open a video's page address, **Then** they see a short, warm prompt ("Create a free account to watch and save your hours") with the video's title and host, and options to sign in or join; the video itself is not played.
3. **Given** the prompt, **When** the visitor signs in or finishes onboarding, **Then** they land on the video they originally chose.
4. **Given** a signed-in learner with a profile for the language, **When** they open any video in that language, **Then** it plays as before.
5. **Given** a signed-in learner who has no profile for the video's language, **When** they open that video, **Then** they are taken to "Add a language" for that language, which asks the same stage and minutes questions as onboarding steps 2 and 3, and then continue to the video.
6. **Given** a signed-out visitor, **When** they open the roadmap or "Done for today" pages or settings, **Then** they are asked to sign in and returned to that page afterwards.
7. **Given** a signed-out visitor, **When** they press the main call to action on the landing page, **Then** they enter onboarding at step 1; a signed-in learner sees the Library instead.

---

### User Story 4 - Choices made before signing up are kept (Priority: P1)

A learner may choose a language, a level and daily minutes, and only then be asked for an account. Those choices must survive signing up, including the round trip through Google or the email inbox, and including the case where the link is opened in another browser tab.

**Why this priority**: Losing the three answers just given at the moment of sign-up would feel broken and would cost sign-ups.

**Independent Test**: Make choices in steps 1–3, request an email link, open the link in a new tab, and confirm the new profile matches the choices.

**Acceptance Scenarios**:

1. **Given** choices in steps 1–3, **When** the learner reloads the page, **Then** they return to the same step with the same choices selected.
2. **Given** choices in steps 1–3, **When** the learner signs up with Google, **Then** the new profile holds exactly those choices.
3. **Given** choices in steps 1–3, **When** the learner signs up through an email link opened in another tab on the same device, **Then** the new profile holds exactly those choices.
4. **Given** the email link is opened on a different device with no saved choices, **When** the account is created, **Then** the learner is asked steps 1–3 once and then continues; nothing is invented for them.
5. **Given** a learner who already has an account and profile for that language, **When** they sign in after making new choices in onboarding, **Then** their existing profile is not overwritten without being asked.
6. **Given** saved choices on a device, **When** the learner signs out, **Then** their account data does not remain visible on the device.

---

### User Story 5 - A separate profile for each language, and adding another (Priority: P2)

Every learner has one profile per language holding their stage and usual minutes per day. They can add another available language later and switch between profiles; changing one never changes another. If a language is not available yet, they can join its waitlist instead.

**Why this priority**: The product is built for many languages from day one, and per-language profiles are the base for hours, rhythm and levels later. Only one language is available at launch, so this is lower than the first journey.

**Independent Test**: With a signed-in learner who has Egyptian Arabic, add a second available language (using a test language in the content data), set different values, and confirm each profile keeps its own stage and minutes.

**Acceptance Scenarios**:

1. **Given** a signed-in learner, **When** they open settings, **Then** they see each language they have a profile for with its stage and minutes per day, and can change both.
2. **Given** a change to the stage or minutes of one language, **When** it is saved, **Then** the other languages' profiles are unchanged and the change is still there after signing out and in.
3. **Given** a signed-in learner, **When** they choose "Add a language", **Then** they see the same language list as onboarding step 1 and, after choosing an available language they do not yet have, they answer the stage and minutes steps and get a new profile.
4. **Given** the language list, **When** a language is already in the learner's profiles, **Then** it is shown as added and cannot be added twice.
5. **Given** a language that is not available, **When** the learner activates "Join the waitlist", **Then** they go to the waitlist on the landing page.
6. **Given** more than one profile, **When** the learner opens the Library or a video, **Then** the profile used is the one for that page's language.
7. **Given** a stage changed in settings, **When** the learner opens the Library, **Then** the stage shown as their current stage reflects the change.

---

### User Story 6 - My transcript and check choices follow me (Priority: P2)

The transcript toggles (Arabic, Tashkeel, Transliteration, English) and the answers to "فاهم؟" are today kept on this device only. Once the learner is signed in, they are kept on their account instead, so they appear on any device. Anything already chosen on this device is not lost.

**Why this priority**: It makes the account worth having and removes repeated setup, but the product works without it.

**Independent Test**: On a device with toggles already changed and some answers given, sign in. Confirm those choices are still shown and now also appear on a second device signed in to the same account.

**Acceptance Scenarios**:

1. **Given** a signed-in learner, **When** they change a transcript toggle on one device, **Then** the same choice applies to every video in that language on any device they sign in to.
2. **Given** a signed-in learner, **When** they answer "فاهم؟" on a video, **Then** the answer is shown on that video on any device they sign in to, and changing the answer replaces the old one.
3. **Given** toggle choices or answers already stored on this device, **When** the learner signs in for the first time on the device, **Then** those choices and answers are copied to the account and continue to show without the learner doing anything.
4. **Given** a choice on this device that conflicts with one already on the account (for example different toggles, or a video answered on both sides), **When** the learner signs in, **Then** the account's saved choice wins. Device choices are used only where the account has none. Nothing is silently deleted from the account.
5. **Given** the device copy has been moved to the account, or some of it could not be moved yet (for example a language with no profile), **When** the learner signs out and another person signs in on the same device, **Then** the first person's choices are gone from the device and the second person does not inherit any of them.
6. **Given** a signed-out visitor, **When** they open a video page, **Then** they see the sign-in prompt (Story 3), no transcript or check is shown, and no this-device copy of these choices is created.
7. **Given** a save to the account fails (for example no connection), **When** the learner changes a toggle, **Then** the choice still applies on screen for the visit, a short quiet note says it could not be saved, and it is saved the next time the change is made online.

---

### User Story 7 - Account button and menu (Priority: P2)

In the header, a signed-out visitor sees a sign-in option; a signed-in learner sees an account button. The button opens a small menu with two choices: Settings and Sign out.

**Why this priority**: It is how learners reach settings and sign out, but depends on the earlier stories to be useful.

**Independent Test**: Sign in, open the account button with the keyboard only, move through both items, open Settings, then sign out from the menu.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they view the header, **Then** they see a "Sign in" link and no account button.
2. **Given** a signed-in learner, **When** they view the header, **Then** they see the account button showing the first letter of their name or email.
3. **Given** the account button, **When** the learner activates it, **Then** a small menu opens with exactly "Settings" and "Sign out".
4. **Given** the open menu, **When** the learner presses Escape, clicks outside it, or tabs out of it, **Then** it closes and focus returns to the account button.
5. **Given** the open menu, **When** the learner uses the arrow keys, **Then** focus moves between the two items, and Enter activates the focused item.
6. **Given** a phone-width screen, **When** the menu opens, **Then** it stays fully on screen and the items are at least 44 pixels high.
7. **Given** the menu, **When** the learner chooses Settings, **Then** the settings page opens and shows their profiles (Story 5) and their email address.

---

### Edge Cases

- A learner closes the browser halfway through onboarding: choices are kept on this device and offered again, not forced.
- The learner tries to go straight to step 4 by address without earlier choices: they are sent to step 1.
- The learner starts onboarding while already signed in with a profile: they are taken to the Library instead; "Add a language" is the way to add another.
- The sign-in email is slow or never arrives: the page offers to send a new link after a short wait, with a sensible limit on how often.
- Someone requests many sign-in links for the same address: sends are limited so the address owner is not flooded.
- The learner opens a sign-in link in a different browser from the one where they started: it still signs them in.
- Two tabs change the same toggle at once: the last change wins and neither tab shows an error.
- A learner's account has no profile left for a language (for instance it was removed by an administrator): the learner is asked to set that language up again; nothing crashes.
- Browser storage is blocked or full: onboarding still works within the visit; choices made before sign-up may not survive the round trip, and the learner is asked the questions again rather than shown wrong data.
- A learner with a profile in a language that later becomes unavailable: their profile is kept and shown, but videos for it say it is on its way.
- Interface elements and messages stay in English left-to-right; any Arabic shown has its own direction and language attributes.
- A signed-out visitor follows a deep link to a free video: they are still asked for an account to watch, as the rule is the same for all videos.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: The landing page, Library, host pages, host list and pricing page MUST be viewable without an account.
- **FR-002**: Playing a video, whether its access is marked free or full, MUST require a signed-in learner who has a profile for the video's language. A signed-out visitor opening a video address MUST see a sign-in prompt showing the video's title and host, never the video, and after signing in MUST land on that video.
- **FR-003**: Saving anything about a learner (profile, transcript choices, check answers, and later hours) MUST require an account. Pages for the learner's own data (roadmap, "Done for today", settings) MUST ask a signed-out visitor to sign in and return them to the page afterwards.
- **FR-004**: Account checks MUST be enforced on the server, not only hidden in the interface, so that a direct request for protected content or data by a signed-out visitor is refused.
- **FR-005**: Any page asking for sign-in MUST keep the address the visitor was trying to reach and return them there after sign-in. Only addresses inside this site MAY be returned to.

**Signing in and out**

- **FR-006**: Learners MUST be able to sign in with a Google account or with an email address through a single-use sign-in link. There MUST NOT be passwords, password fields or password reset anywhere.
- **FR-007**: A sign-in link MUST work once, expire after a short time (60 minutes), and work from any browser or device. Reusing or expiring a link MUST show a kind message and offer a new link.
- **FR-008**: Requests for sign-in links MUST be limited so the feature cannot be used to flood an inbox: at most 5 per email address and 20 per visitor in any hour, and at least 30 seconds between two links to the same address. Over the limit the learner sees a kind "please wait" message and no email is sent. The "check your email" page MUST offer "Send it again" after a short wait, under the same limits.
- **FR-009**: A learner using Google and an email link with the same email address MUST end up with one account.
- **FR-010**: Signing in with a new email address MUST create an account automatically. No separate registration form is needed.
- **FR-011**: The account menu MUST include "Sign out". Signing out MUST end the session, return the learner to the landing page, and make protected pages and videos unavailable again.
- **FR-012**: A signed-in session MUST last long enough that a learner is not asked to sign in more than once every 30 days on the same device when used regularly.
- **FR-013**: Sign-in messages MUST follow the brand voice (short, warm, honest, never shaming) and MUST NOT reveal whether an email address already has an account.

**Onboarding**

- **FR-014**: Onboarding MUST have four steps in this order, matching `docs/design/Onboarding.dc.html` in layout, spacing, colour, type and copy: choose a language, how much you know, minutes per day, create account. It MUST show "Step N of 4" and a four-part progress bar and MUST allow going back with earlier choices kept.
- **FR-015**: The language step MUST list languages from the language data. A language marked available MUST be selectable. A language not available MUST be shown dimmed with a "Join the waitlist" link to the landing-page waitlist. Adding a language to the data MUST add it to this list without changing the page.
- **FR-016**: Pressing Continue on a step with a preselected option (level on step 2, minutes on step 3) MUST save the option shown, even if the learner did not touch it. The level step MUST offer four self-description options, each mapped to a learner stage: "None at all" and "Some words and phrases" to Hear it, "I can follow slow, simple talk" to Follow it, "I understand a lot of everyday talk" to Understand it. The option "None at all" is preselected. Internal level names MUST NOT appear.
- **FR-017**: The level step MUST show an optional listening check offer ("Try a short listening check. It's optional and there's no score."). In this version it MAY lead to a placeholder that says the check is coming; it MUST NOT block Continue, MUST NOT produce a score, and MUST NOT change the stage chosen.
- **FR-018**: The time step MUST offer 10, 20, 30 and 60 minutes with 20 preselected, and exactly one MUST be chosen. The copy MUST state that there are no streaks and nothing to lose.
- **FR-019**: The final step MUST offer "Continue with Google" and an email field with a sign-in link, MUST say there is no password, and MUST show the action to continue ("Start watching") only when the learner is signed in.
- **FR-020**: Choices from steps 1–3 MUST be kept while the learner moves between steps, reloads the page, and goes through Google or the email inbox, and MUST be turned into the learner's profile when the account is created or when they first sign in.
- **FR-021**: If a signed-in learner already has a profile for the chosen language, their existing profile MUST NOT be changed by onboarding choices unless they confirm.
- **FR-022**: All onboarding options MUST be real, labelled radio-style controls with visible focus, keyboard operation, at least 44 pixels height, and the current step announced to assistive technology. Selected state MUST be shown by more than colour.
- **FR-023**: Visiting a later step without the earlier choices MUST send the learner back to the first missing step.

**Profiles**

- **FR-024**: Each learner MUST have at most one profile per language. A profile holds the learner's stage and usual minutes per day and nothing else in this version. Profiles MUST be independent of one another.
- **FR-025**: A learner MUST be able to see and change the stage and minutes per day of each profile in settings. Valid stages are Hear it, Follow it, Understand it, Join in. Valid minutes are 10, 20, 30 and 60.
- **FR-026**: A learner MUST be able to add a profile for another available language through the same language list as onboarding, answering only the stage and minutes steps, and MUST NOT be able to add one for an unavailable language or a language they already have.
- **FR-027**: The language used for the Library, videos and settings MUST follow the language in the page address, with the matching profile applied.
- **FR-028**: Existing learner data MUST be kept per language, never pooled, so that later features (hours, rhythm, level) can attach to a profile.

**Moving device choices to the account**

- **FR-029**: For a signed-in learner, transcript layer choices and the answers to "فاهم؟" MUST be stored on the learner's account, per language, and MUST be available on every device they sign in to. This storage replaces the this-device storage as the source of truth.
- **FR-030**: The first time a learner signs in on a device that holds transcript choices or check answers, the system MUST copy them to the account and keep showing them. Where the account already has a choice (a language's toggles, or the answer for a video), the account's choice wins; device choices are used only where the account has none. Nothing already on the account MUST be lost.
- **FR-031**: After the device copy has been moved, it MUST be removed from the device. Any device choices that could not be moved (for example for a language with no profile) MUST be removed when the learner signs out. Another person signing in on that device MUST NOT see or receive any of them.
- **FR-032**: If saving to the account fails, the choice MUST still take effect on screen for the visit, the learner MUST see a short, quiet note, and the next successful change MUST save the current state. Nothing MUST be lost silently.
- **FR-033**: Autoplay-next and any other player preference not named above remain as they are in Spec 3 and are not moved.

**Account button and menu**

- **FR-034**: The header MUST show "Sign in" for a signed-out visitor and an account button for a signed-in learner, replacing any placeholder from earlier specs.
- **FR-035**: The account button MUST open a small menu with exactly "Settings" and "Sign out". It MUST be a real button with an accessible name, expose whether the menu is open, open and close by keyboard, move between items with arrow keys, close with Escape or an outside click and return focus to the button, and have items at least 44 pixels high.
- **FR-036**: The settings page MUST show the learner's email address, each language profile (stage and minutes per day) with the means to change them, and "Add a language". It MUST use the shared header and navigation.

**Content and brand**

- **FR-037**: All new copy MUST follow the brand voice and the learner-facing terms in `docs/product.md`. There MUST be no streaks, no forced tests, no notifications switched on, and no infinite lists.
- **FR-038**: All new screens MUST work from 360 pixels wide, have text contrast of at least 4.5:1 and meet the design system for focus, motion and touch targets.

**Privacy and security**

- **FR-039**: The system MUST collect only what it needs: email address, display name and image from Google when offered, language profiles, transcript choices and check answers. It MUST NOT collect passwords, payment details or location.
- **FR-040**: Every request that changes learner data MUST check that the signed-in learner owns that data, and MUST validate its input. A learner MUST NOT be able to read or change another learner's data.
- **FR-041**: Secrets for sign-in MUST NOT be sent to the browser.

### Key Entities

- **Learner (account)**: A person with a free account. Has an email address, optionally a name and image, and signs in with Google or an email link. Owns any number of language profiles.
- **Sign-in link**: A single-use, short-lived token sent to an email address that signs the holder in.
- **Language profile**: One learner's relationship with one language: the language, the learner's stage (Hear it, Follow it, Understand it, Join in), and usual minutes per day (10, 20, 30, 60). At most one per learner per language. Later specs attach hours and rhythm to it.
- **Onboarding draft**: The language, stage and minutes chosen before an account exists. Lives on the device until it becomes a language profile, then is discarded.
- **Transcript preferences**: A learner's four layer toggles for one language. One set per language profile.
- **Check answer**: A learner's "فاهم؟" answer for one video. One current answer per learner per video.
- **Language (existing)**: From the language data, with an availability flag used to decide between "Available" and "Join the waitlist".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can go from the first onboarding step to being signed in and in the Library in under 2 minutes, not counting the time to open an email.
- **SC-002**: In 100% of tests, choices made in steps 1–3 appear in the new profile after sign-up with Google, with an email link in the same tab, and with an email link in another tab on the same device.
- **SC-003**: A signed-out visitor never sees a playing video and never loses their place: after signing in, 100% of the time they land on the video they asked for.
- **SC-004**: Landing, Library, host and pricing pages show their full content to a signed-out visitor with no sign-in prompt, in 100% of tests.
- **SC-005**: Signed-in learners find "Sign out" within two actions from any page, and signing out removes access to protected pages and videos immediately.
- **SC-006**: After signing in on a device holding earlier transcript choices and answers, 100% of those choices and answers are still displayed and 100% appear on a second device signed in to the same account.
- **SC-007**: Changing one language's stage or minutes leaves every other language's profile unchanged in 100% of tests.
- **SC-008**: Onboarding and the account menu can be completed using only a keyboard, and every control meets the 44-pixel and 4.5:1 contrast rules, with no horizontal scrolling at 360 pixels wide.
- **SC-009**: No screen, message or email in this feature mentions a password, a streak, a score or an internal level name.
- **SC-010**: Requesting a sixth sign-in link for one address within an hour is refused with a kind message, and a direct request for protected data without signing in returns nothing, in 100% of tests.

## Assumptions

- Egyptian Arabic is the only available language at launch; Spanish and "Something else" appear as waitlist entries. Availability is taken from the language data.
- Free accounts are all that exists in this version. Free versus full access, pricing and payments are not part of this spec; every signed-in learner with a profile may watch every video until a later spec says otherwise.
- The optional listening check is a placeholder only: it explains that a short check is coming and never changes the stage.
- "Join in" is not offered as a self-description in onboarding (the design shows four options up to "Understand it"), but can be chosen in settings.
- The default minutes per day is 20 and the default level option is "None at all", as in the design.
- A new learner who signs in with no onboarding choices and no profile is sent through steps 2 and 3 for the language in the address, or through the full flow if there is none.
- Hours tracking, "Done for today" behaviour, rhythm, payments, a real level test, notification settings and deleting an account are out of scope. Settings shows only email and language profiles; account deletion is a future spec.
- Display names and images from Google are used only for the initial on the account button.
- Email delivery uses a transactional email service; its choice is a planning decision. Sign-in emails are in English.
- The previously this-device keys for transcript layers and check answers (Spec 3) are known and can be read once to move them across; choices for languages without a profile stay on the device until the learner signs out, when they are removed. If a session simply expires without a sign-out, such leftovers are not removed until the next sign-out.
- Learners are adults studying alone; no age gate, parental flow or exam features are added.
- Stage is a learner's own estimate and can be changed at any time; it does not hide any content in this version.
