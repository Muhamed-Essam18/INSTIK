# Feature Specification: Marketing Pages

**Feature Branch**: `006-marketing-pages`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Spec 6: marketing pages. Landing page matching `docs/design/Landing.dc.html` (hero with the tagline, three pillars, how it works, four stages with estimate placeholders, waitlist, "Is this AI?" answer, final call to action; calls to action go to onboarding, or the library if signed in). Waitlist saves a language and an email, confirms kindly, ignores duplicates, and is also used by onboarding's "Join the waitlist". Pricing page matching `docs/design/Pricing.dc.html` with Free and Full access, a monthly/yearly switch, placeholder prices and the FAQ; buttons go to onboarding for now. An About page with the pronunciation (in-STICK), the method in plain words and the hosts promise; a simple Privacy page placeholder. Good sharing and search basics: page titles, descriptions and a social share image in the brand style. Out of scope: real payments, emailing the waitlist."

## Clarifications

### Session 2026-11-08

- Q: Should the waitlist form tell people what we'll do with their email? → A: Yes. A short line ("We'll only use this to tell you when your language is ready.") with a link to the Privacy page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand Instik and start (Priority: P1)

A first-time visitor opens the landing page and quickly understands what Instik is: the tagline "Your scroll time, but it counts.", the three pillars (Real people, At your level, Counted), how it works in three steps, the four stages with honest estimates, and the answer to "Is this AI?". Every "Start watching free" button takes them to onboarding. A signed-in learner who presses the same buttons goes to their library instead.

**Why this priority**: The landing page is the front door. Without it nobody reaches onboarding.

**Independent Test**: Open the landing page signed out and read it top to bottom against the design; press each call to action and land in onboarding. Repeat signed in and land in the library.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** the landing page opens, **Then** they see, in order: the hero with the tagline and "Now teaching Egyptian Arabic", the three pillars, how it works (three numbered steps), the four stages, the waitlist, "Is this AI?", the final call to action and the footer.
2. **Given** the four stages section, **When** a visitor reads it, **Then** the stages are Hear it, Follow it, Understand it and Join in, each with a one-line description and a clearly marked estimate placeholder, and the section says hours are estimates, not promises. Internal level names never appear.
3. **Given** a signed-out visitor, **When** they press any "Start watching free" button (header, hero, final call to action), **Then** they go to onboarding.
4. **Given** a signed-in learner, **When** they press the same buttons, **Then** they go to the library, and the header shows no "Log in" prompt.
5. **Given** the pillar "Real people", **When** the visitor presses "Meet the hosts", **Then** they reach the hosts.
6. **Given** a phone-sized screen, **When** the page is viewed, **Then** every section stays readable with no sideways scrolling and the Arabic sample line keeps its own right-to-left direction.
7. **Given** the page copy, **When** it is read, **Then** it follows the brand voice (short, warm, honest, never shaming) and contains no streaks, countdowns or urgency.

---

### User Story 2 - Join the waitlist for another language (Priority: P1)

A visitor who wants a language other than Egyptian Arabic picks it, enters an email and joins the waitlist. They get a kind confirmation. Joining again with the same language and email is quietly accepted without creating a second entry. Onboarding's "Join the waitlist" links lead to this same waitlist.

**Why this priority**: It captures demand for other languages and fixes a dead end already present in onboarding.

**Independent Test**: Submit a language and email, see the confirmation; submit the same pair again and confirm there is still one entry and the visitor sees the same kind confirmation. Follow "Join the waitlist" from onboarding and land on the waitlist with the chosen language preselected.

**Acceptance Scenarios**:

1. **Given** the waitlist, **When** a visitor chooses a language (Spanish, French or Other), enters a valid email and submits, **Then** one entry is saved and a warm confirmation replaces or follows the form.
2. **Given** an email and language already on the waitlist, **When** the same pair is submitted again (including different letter case or surrounding spaces in the email), **Then** no second entry is created and the visitor sees the same kind confirmation.
3. **Given** the same email with a different language, **When** submitted, **Then** it is saved as a separate entry.
4. **Given** an empty or invalid email, **When** the visitor submits, **Then** nothing is saved and a gentle message explains what to fix, with their other input kept.
5. **Given** a failure while saving, **When** the visitor submits, **Then** they see a kind, plain message to try again and their input is kept.
6. **Given** onboarding's language step, **When** a learner activates "Join the waitlist" on a language, **Then** they reach the landing page waitlist section with that language preselected.
7. **Given** the waitlist form, **When** the visitor looks at it, **Then** a short line under the email field says "We'll only use this to tell you when your language is ready." and links to the Privacy page.
8. **Given** the waitlist is used, **When** the visitor reads the page, **Then** nothing promises a schedule of emails, and no email is sent by Instik in this version.

---

### User Story 3 - See what it costs (Priority: P2)

A visitor opens the pricing page and sees Free and Full access side by side, a Monthly/Yearly switch that changes the Full access price label, placeholder prices, what each plan includes and a short FAQ. Buttons lead to onboarding for now.

**Why this priority**: Visitors ask about cost before committing, but payments don't exist yet, so this page informs and routes only.

**Independent Test**: Open the pricing page, toggle Monthly and Yearly and confirm the Full access label changes; press both buttons and land in onboarding.

**Acceptance Scenarios**:

1. **Given** the pricing page, **When** it opens, **Then** it shows the headline "Start free. Stay because it works.", the Monthly/Yearly switch with Monthly selected, the Free card ("0 forever" and its four items), the Full access card (placeholder price, "per month", its five items, a savings placeholder) and the four FAQ questions with answers.
2. **Given** the switch, **When** the visitor chooses Yearly, **Then** the Full access card shows "per year" and the Yearly choice is marked selected; choosing Monthly restores "per month". The switch works from the keyboard and tells assistive technology which choice is selected.
3. **Given** prices are undecided, **When** the page shows them, **Then** they are visibly placeholders (for example "[PRICE]") and no real amount is shown.
4. **Given** "Start watching free" or "Get full access", **When** pressed, **Then** the visitor goes to onboarding (signed-in learners go to the library).
5. **Given** the FAQ, **When** read, **Then** it covers cancelling, "Is this AI?", how long until understanding, and which languages are coming, with the language answer pointing to the waitlist.

---

### User Story 4 - Learn who we are, and read the privacy page (Priority: P3)

A curious visitor opens About to learn how to say the name (in-STICK), the method in plain words (understanding, not drills) and the hosts promise (real native speakers, named and visible on every video). The footer also links to a simple Privacy page that is clearly a placeholder for now.

**Why this priority**: These build trust but aren't needed to start learning.

**Independent Test**: Open About and Privacy from the footer on the landing page and confirm the content and that every footer link resolves to a real page.

**Acceptance Scenarios**:

1. **Given** the About page, **When** it opens, **Then** it shows the pronunciation "in-STICK", the method in plain words and the hosts promise, in the brand voice.
2. **Given** the Privacy page, **When** it opens, **Then** it shows a short plain-language placeholder saying what is collected today (account email, language, learning hours, waitlist emails) and that a full policy is coming, without legal claims it cannot back up.
3. **Given** the footer on marketing pages, **When** a visitor uses About, Hosts, Pricing and Privacy, **Then** each reaches a real page.
4. **Given** the header on marketing pages, **When** a visitor uses "How it works", "Hosts" and "Pricing", **Then** each goes to the matching section or page.

---

### User Story 5 - Sharing and search basics (Priority: P3)

When someone shares a marketing page link or finds it in search, it shows a clear title, a useful description and a social image in the Instik brand style.

**Why this priority**: It improves reach but doesn't change how the pages work.

**Independent Test**: Inspect each marketing page's title and description, and preview a link to each in a share preview tool; confirm the image shows the brand name and tagline.

**Acceptance Scenarios**:

1. **Given** each marketing page (landing, pricing, About, Privacy), **When** it is shared or indexed, **Then** it has its own unique title and description of reasonable length.
2. **Given** a shared link, **When** a preview is generated, **Then** it shows a share image in the brand style (brand colours, wordmark and the tagline) at a standard share size.
3. **Given** the search engine view, **When** it reads the site, **Then** marketing pages are indexable and have a sitemap entry and robots guidance, and signed-in or utility pages (sign-in, settings, onboarding) are not promoted.
4. **Given** the landing page, **When** a search engine reads it, **Then** the page has one main heading and the "Is this AI?" answer is plain readable text.

---

### Edge Cases

- Visitor submits the waitlist twice quickly (double press): only one entry exists and one confirmation shows.
- Waitlist email is very long, has odd casing, or has leading or trailing spaces: it is trimmed and compared without regard to case; overly long input is rejected kindly.
- A language that is not in the waitlist list (for example, a hand-edited link): the form falls back to no selection and asks them to choose.
- A robot fills in the waitlist: a hidden trap field causes the submission to be silently ignored, with no visible difference for humans.
- Signed-in learner opens the landing page: still sees the landing page, but calls to action go to the library.
- Visitor with scripts blocked opens the pricing page: both plans and the Monthly price are still readable and the buttons still work.
- Reduced-motion preference: no animation is needed to understand any section.
- Arabic sample text in the hero: shown with tashkeel, in its own right-to-left block with correct fonts, never mirrored by the English layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The landing page MUST match `docs/design/Landing.dc.html` in section order, layout, spacing, colour, type and copy: header, hero (with "Now teaching Egyptian Arabic", tagline, supporting line, call to action, waitlist hint, sample card with Arabic line, transliteration and translation, and an hours badge), three pillars, how it works, four stages, waitlist, "Is this AI?", final call to action, footer with "Say it: in-STICK".
- **FR-002**: Every "Start watching free" and "Get full access" button MUST lead to onboarding for signed-out visitors and to the library for signed-in learners. The header "Log in" MUST be shown only to signed-out visitors.
- **FR-003**: The four stages MUST appear as Hear it, Follow it, Understand it and Join in, each with a description and an hours estimate placeholder, and MUST state that hours are estimates. Estimates MUST come from the language data, and MUST be shown as a placeholder while the language's estimates are marked provisional or are missing; real figures appear only once they are final. Internal level names MUST NOT appear.
- **FR-004**: The landing page MUST NOT use streaks, countdowns, urgency, shame, infinite scroll or autoplaying media.
- **FR-005**: The waitlist MUST save a language and an email, trim and case-fold the email, show a warm confirmation on success, and show a gentle message on invalid or missing input without losing what the visitor typed.
- **FR-005a**: The waitlist form MUST show, under the email field, the line "We'll only use this to tell you when your language is ready." with a link to the Privacy page. The Privacy page MUST mention waitlist emails and that they are used only for that purpose.
- **FR-006**: The waitlist MUST treat a repeated language-and-email pair as a success without creating another entry, and MUST NOT reveal to the visitor whether the pair already existed. A different language with the same email MUST be a separate entry.
- **FR-007**: The language choices on the waitlist MUST come from language data (languages not yet available, plus "Other"), and adding a language to the data MUST add it to the waitlist without changing the page.
- **FR-008**: Onboarding's "Join the waitlist" MUST lead to the landing page waitlist with the relevant language preselected, and the waitlist MUST work the same from there.
- **FR-009**: The waitlist MUST resist simple automated spam (hidden trap field and a limit on how often one visitor can submit) while remaining usable with a keyboard and a screen reader.
- **FR-010**: Waitlist entries MUST be stored with language, email and the date joined, and nothing else about the visitor. No email MUST be sent to waitlist members in this version.
- **FR-011**: The pricing page MUST match `docs/design/Pricing.dc.html` in layout, spacing, colour, type and copy: headline, subline, Monthly/Yearly switch, Free card, Full access card, FAQ.
- **FR-012**: The Monthly/Yearly switch MUST start on Monthly, change the Full access period label ("per month" / "per year"), be operable by keyboard and expose its selected state to assistive technology.
- **FR-013**: Prices and the savings percentage MUST be configurable placeholders, shown visibly as placeholders (for example "[PRICE]") until the real prices are decided, and MUST NOT appear as real amounts.
- **FR-014**: The pricing page MUST list the Free items (a starter set of Hear it and Follow it videos, hours counter and roadmap, interactive transcripts, rhythm view) and the Full access items (every video at every stage, new videos every week, every host, interactive transcripts with word meanings, add time spent outside Instik), and the four FAQ questions with the answers in the design.
- **FR-015**: No real payment, checkout, card form or subscription MUST be offered in this version.
- **FR-016**: An About page MUST show the pronunciation "in-STICK", the method in plain words (learning by understanding, no drills, tests or streak panic, honest hours) and the hosts promise (real native speakers, named and visible on every video, no synthetic voices).
- **FR-017**: A Privacy page MUST exist as a short, plain placeholder that lists what is collected today and says a full policy is coming. It MUST NOT make legal or compliance claims.
- **FR-018**: The header and footer MUST be consistent across all marketing pages. Every link MUST resolve to a real page or section, including the Hosts link.
- **FR-019**: Each marketing page MUST have a unique title, a description, a single main heading and a social share image in the brand style (brand colours, wordmark and tagline) at a standard share size.
- **FR-020**: The site MUST provide a sitemap listing the marketing pages and robots guidance that keeps account and utility pages out of search results.
- **FR-021**: All marketing pages MUST be responsive from phone to wide desktop with no sideways scrolling, meet accessible contrast and keyboard use, and follow the design system tokens.
- **FR-022**: Marketing pages MUST load without requiring sign-in, and signed-in state MUST only change the call-to-action destinations and the header.

### Key Entities *(include if feature involves data)*

- **Waitlist entry**: One visitor's request for one language. Has a language, an email (stored in a normalised form) and the date joined. Unique per language and email.
- **Language (existing)**: From the language data; languages that are not available feed the waitlist choices and the stage estimates.
- **Marketing page**: Landing, Pricing, About, Privacy, each with its own title, description and share image.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from the landing page's first screen to the first onboarding screen in one click, without scrolling.
- **SC-002**: A visitor can join the waitlist in under 30 seconds (choose a language, enter an email, submit) and sees a confirmation immediately.
- **SC-003**: Submitting the same language and email any number of times results in exactly one stored entry.
- **SC-004**: Side by side with the design at phone, tablet and desktop widths, the landing and pricing pages show no visible differences in layout, colour, type or copy beyond the placeholders.
- **SC-005**: 100% of footer and header links on marketing pages lead to a real page or section.
- **SC-006**: Every marketing page has a unique title and description, and a link preview shows the brand share image for 100% of them.
- **SC-007**: All marketing pages can be used with only a keyboard, and the Monthly/Yearly switch and waitlist form are fully announced by a screen reader.
- **SC-008**: On a typical mobile connection, the landing page's main content is readable within 2 seconds.
- **SC-009**: No marketing page contains a streak, countdown, real price, internal level name or an unqualified hour promise.

## Assumptions

- The language list for the waitlist is: languages in the language data that are not yet available, plus "Other"; at launch that gives Spanish, French and Other as in the design.
- The "Hosts" links go to the existing hosts index for the launch language (Egyptian Arabic); no new hosts page is built here.
- The stage hour estimates are placeholders (`[~X hours]`) until decided; real figures come from the language data and need no code change.
- Free and Full access limits are descriptive only; no content gating or payments are added here.
- The waitlist stores only language, email and the date joined; the visitor is not asked for a name, and no marketing email is sent.
- The Privacy page text is a temporary placeholder and will be replaced with a reviewed policy before public launch.
- The share image is one generic brand image used for all marketing pages; per-page images are not required.
- The pages are in English only, as is the rest of the interface.
