# Feature Specification: App Foundation and Shell

**Feature Branch**: `001-app-foundation-shell`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Build the foundation of the Instik website that every other screen sits on: a shared page shell (header with lowercase instik wordmark, main navigation Library / Roadmap / Hosts, Hours pill placeholder, account button, simple footer with 'Say it: in-STICK'); the Instik look applied everywhere; languages defined as data (Egyptian Arabic available, Spanish 'coming soon'), with language pages under /learn/<language-slug>; Arabic displaying correctly inside the English interface; empty placeholder pages for every MVP screen so navigation works end to end. Out of scope: real content, accounts, video playback, hours tracking and payments."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move through every screen with a consistent shell (Priority: P1)

A visitor opens Instik and can reach every MVP screen (landing, onboarding, library, player, done for today, roadmap, host, pricing) using the header, footer and in-page links. Every page shares the same header and footer, so the site feels like one product even though the pages are still empty.

**Why this priority**: The shell and routes are what every later spec builds on. Without them no other screen can be added or reviewed in context.

**Independent Test**: Open the landing page and follow links until each of the eight screens has been visited, then return to the start. Each page shows the shared header and footer and a clear page title.

**Acceptance Scenarios**:

1. **Given** any page inside the shell, **When** the visitor looks at the top, **Then** they see the lowercase "instik" wordmark linking to the landing page, the navigation items Library, Roadmap and Hosts, an Hours pill placeholder, and an account button.
2. **Given** the visitor is on the Library, Roadmap or Hosts page, **When** they view the navigation, **Then** the item for the current page is visibly marked as current.
3. **Given** any page, **When** the visitor scrolls to the bottom, **Then** they see the footer with the "instik" name and "Say it: in-STICK".
4. **Given** the visitor selects Library, Roadmap or Hosts, **When** the page loads, **Then** they arrive at the matching screen for the current language without a dead end or error.
5. **Given** any MVP screen, **When** it loads, **Then** it shows a clear heading naming the screen and a short note that the content is coming, not a blank page.

---

### User Story 2 - See the Instik look on every page (Priority: P1)

Every page looks like Instik: cream background, ink text, the brand colours, the brand fonts, the spacing scale and rounded corners from the design system. A teammate building a later screen only has to supply content.

**Why this priority**: Visual fidelity is a project requirement, and sharing it from the start prevents each later screen from drifting.

**Independent Test**: Compare the shell and a placeholder page with the approved screens in `docs/design/` at phone and desktop widths. Header, footer, colours, type and corners match. Check text contrast and touch target sizes.

**Acceptance Scenarios**:

1. **Given** any page, **When** it renders, **Then** the page ground is cream, text is ink, and headings use the headline font while body and UI text use the body font.
2. **Given** the header navigation, Hours pill and account button, **When** the visitor views them, **Then** their shape, spacing and colours match the approved screens, with rounded corners and no sharp corners.
3. **Given** any interactive element, **When** the visitor uses a keyboard or a touch screen, **Then** it can be reached and activated, shows a visible focus state, and has a touch target of at least 44px.
4. **Given** the page at phone width and at desktop width, **When** it renders, **Then** the header wraps cleanly with no horizontal scrolling and no overlapping elements.
5. **Given** any text on any page, **When** contrast is measured, **Then** it is at least 4.5:1 against its background. Coral is used only as a fill with ink labels.

---

### User Story 3 - Languages as data, with language-scoped pages (Priority: P2)

Languages are defined as data. Egyptian Arabic is available and Spanish is listed as "coming soon". Each language has a URL slug, and language-specific pages live under `/learn/<language-slug>`. Adding a language later means adding data, not changing page code.

**Why this priority**: The constitution requires multi-language design from the start. It is P2 because the shell is usable with only one language, but retrofitting language-scoped URLs later would be costly.

**Independent Test**: Visit the Egyptian Arabic language pages by slug and confirm they load. Add a test language entry to the data and confirm its pages become reachable and it appears in the language list with no code change. Visit an unknown slug and a "coming soon" slug.

**Acceptance Scenarios**:

1. **Given** the language data lists Egyptian Arabic as available, **When** the visitor opens `/learn/arabic-egyptian`, **Then** the language's library page loads inside the shell.
2. **Given** the language data lists Spanish as "coming soon", **When** the visitor sees the language list, **Then** Spanish appears labelled "coming soon" and does not lead to learning pages.
3. **Given** the visitor opens the learning URL of a "coming soon" language, **When** the page loads, **Then** they see a friendly "coming soon" message and a way back, not an error.
4. **Given** a slug that is not in the language data, **When** the visitor opens it, **Then** they see a friendly not-found page inside the shell with a way back.
5. **Given** a new language entry is added to the data, **When** the site is rebuilt, **Then** it appears in the list and its pages are reachable without code changes.
6. **Given** the language data is invalid (for example a missing slug, direction or duplicate slug), **When** the site is built, **Then** the build fails with a message naming the problem.

---

### User Story 4 - Arabic reads correctly inside the English interface (Priority: P2)

Wherever a block of target-language text appears, Arabic displays right-to-left in the Arabic fonts at the larger size, while the English interface around it stays left-to-right. Arabic and Latin text look balanced side by side.

**Why this priority**: Arabic is a brand asset and a constitutional requirement. Every later screen with transcripts, host names or word cards relies on this foundation.

**Independent Test**: View a sample block containing Arabic with tashkeel next to English text. The Arabic runs right-to-left, vowel marks are not clipped or colliding, and its size and line height look balanced with the English.

**Acceptance Scenarios**:

1. **Given** a target-language block in Egyptian Arabic, **When** it renders, **Then** it is marked right-to-left with the Egyptian Arabic language code, and its direction and language come from the language data.
2. **Given** Arabic text with tashkeel, **When** it renders, **Then** all vowel marks are visible and none are clipped or overlapped by neighbouring lines.
3. **Given** Arabic and English text on one line or in one card, **When** the visitor views them, **Then** the Arabic is about 1.4 times the Latin size with a taller line height and the pair looks balanced.
4. **Given** a language whose data says left-to-right, **When** a target-language block renders, **Then** it is marked left-to-right with that language's code, using the same mechanism.
5. **Given** an Arabic block inside the English page, **When** the page renders, **Then** the surrounding navigation, headings and layout remain left-to-right.

---

### Edge Cases

- A visitor opens a URL that matches no page: they see a friendly not-found page inside the shell.
- A language slug differs only in letter case or has a trailing slash: it resolves to the same page or redirects to the canonical URL.
- A very long Arabic string or an English string in a narrow layout: text wraps without overflow or horizontal scroll.
- The header at narrow widths with long labels: navigation, Hours pill and account button wrap to a second row without overlap.
- The Arabic or brand fonts fail to load: text falls back to a readable system font and the layout stays usable.
- The language data has zero available languages: the build fails rather than shipping an empty product.
- A visitor with reduced-motion settings: the shell has no motion beyond calm, short transitions, and none when reduced motion is requested.

## Requirements *(mandatory)*

### Functional Requirements

**Shell and navigation**

- **FR-001**: Every page in the product MUST be wrapped in one shared shell with a header and a footer.
- **FR-002**: The header MUST show the lowercase "instik" wordmark linking to the landing page, a main navigation with Library, Roadmap and Hosts, an Hours pill placeholder, and an account button, matching the approved designs.
- **FR-003**: The navigation MUST mark the current section as current, both visually and for assistive technology.
- **FR-004**: The Hours pill MUST be a non-functional placeholder showing no real tracked time and MUST NOT imply real data; it links to the Roadmap page.
- **FR-005**: The account button MUST be present as a placeholder and MUST NOT start any sign-in or account flow in this spec.
- **FR-006**: The footer MUST show the "instik" name and "Say it: in-STICK", and may include simple links to About, Hosts, Pricing and Privacy as in the approved designs. Links to pages that do not exist yet MUST NOT lead to errors.
- **FR-007**: The landing page and the "Done for today" page MAY use the layouts shown in the approved designs where they differ from the standard header, but they MUST remain inside the shared shell system.
- **FR-008**: The shell MUST work at phone and desktop widths with no horizontal scrolling.

**Pages and routes**

- **FR-009**: The product MUST provide an empty placeholder page for each MVP screen: landing, onboarding, library, player, done for today, roadmap, host and pricing. Each shows a screen heading and a short "coming soon" note.
- **FR-010**: Language-specific screens (library, player, done for today, roadmap, host) MUST live under `/learn/<language-slug>`. Landing, onboarding and pricing are language-independent.
- **FR-011**: From any page, a visitor MUST be able to reach every other MVP screen through navigation or in-page links, so the full set can be visited without typing a URL.
- **FR-012**: Unknown URLs and unknown language slugs MUST show a friendly not-found page in the shell with a way back.
- **FR-013**: Every page MUST have a unique, meaningful page title and exactly one top-level heading.
- **FR-014**: Placeholder pages MUST use real learner-facing terms (Hours, Roadmap, Hosts, Up next, Done for today) and the brand voice, and MUST NOT show internal level names.

**Look and accessibility**

- **FR-015**: The shell MUST apply the design system's cream ground, ink text, brand colours, four font families, spacing scale, rounded corners and soft depth through shared design tokens, so later screens need no hard-coded values.
- **FR-016**: Coral MUST be used only as a fill with ink labels. All text MUST meet 4.5:1 contrast. Interactive elements MUST have touch targets of at least 44px and a visible focus state.
- **FR-017**: The shell MUST use semantic page structure (header, navigation with a label, main, footer) and be fully operable by keyboard, including a skip link to the main content.
- **FR-018**: Motion MUST be calm and short and MUST be reduced or removed for visitors who request reduced motion.
- **FR-019**: Fonts MUST load with real fallbacks so text stays readable if a font fails.

**Languages as data**

- **FR-020**: Languages MUST be defined in a single data file. Each entry has at least a code, display name, variety, URL slug, script, text direction, fonts, availability status (available or coming soon), and the transcript layers it uses.
- **FR-021**: The data MUST list Egyptian Arabic as available (slug `arabic-egyptian`, right-to-left, language code `arz`) and Spanish as coming soon.
- **FR-022**: The language data MUST be validated at build time. Missing required fields, duplicate slugs, invalid directions and an empty set of available languages MUST fail the build with a clear message.
- **FR-023**: Adding a language MUST require only a data change, not a change to page or component code.
- **FR-024**: Language pages MUST resolve the language from the URL slug against the data. "Coming soon" languages show a friendly notice instead of learning pages.

**Target-language text**

- **FR-025**: The system MUST provide one shared way to render any target-language block that sets its own direction and language code from the language data, and applies the language's fonts and size.
- **FR-026**: For Arabic, the block MUST use the Arabic fonts at about 1.4 times the Latin size with a tall line height, so vowel marks are never clipped or colliding.
- **FR-027**: Target-language blocks MUST NOT change the direction or layout of the surrounding English interface.
- **FR-028**: Text stored with tashkeel MUST be displayed exactly as stored, with no stripping or alteration on display.

### Key Entities

- **Language**: A language learners can study. Has a code, display name, variety, URL slug, script, text direction, fonts, availability (available or coming soon) and the transcript layers it uses. Everything learner-facing later belongs to one language.
- **Screen**: One of the eight MVP screens. Has a name, a place in the navigation or links, and whether it is language-specific or language-independent.
- **Target-language block**: A piece of text in the language being learned, displayed with its own direction, language code and fonts inside the English interface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can reach all eight MVP screens starting from the landing page using only on-page links, with no dead ends or errors, in 100% of tested paths.
- **SC-002**: 100% of pages show the same header and footer content, and the current section is marked on Library, Roadmap and Hosts.
- **SC-003**: A design review of the shell against the approved screens at phone width and desktop width finds no differences in layout, colour, type, spacing or corners beyond the agreed placeholder content.
- **SC-004**: All text meets at least 4.5:1 contrast and all interactive elements are at least 44px, with zero failures in an automated accessibility check and a manual keyboard-only walkthrough of every page.
- **SC-005**: Adding a new language takes one data entry and no code change, and the language's pages are reachable after a rebuild.
- **SC-006**: Invalid language data is caught before release: every tested invalid case (missing field, duplicate slug, bad direction, no available language) fails the build.
- **SC-007**: A sample of Arabic text with tashkeel renders with every vowel mark visible, right-to-left, balanced beside English text, in a review by a reader of Arabic.
- **SC-008**: No page produces horizontal scrolling at widths from 320px up to desktop.

## Assumptions

- The approved screens in `docs/design/` are the visual reference for the header, footer and look. Placeholder content in them (names, titles, "12h 40m") is not final.
- The Hours pill shows neutral placeholder text (for example "Hours 0h") and links to the Roadmap, with no tracked time, since hours tracking is out of scope.
- The account button shows a neutral placeholder and does nothing yet. Sign-in comes in a later spec.
- Language-specific screens live under `/learn/<language-slug>`: library at the language root, then player, done for today, roadmap and hosts beneath it. Exact sub-paths are decided in planning. Landing, onboarding and pricing sit outside the language path.
- Navigation items Library, Roadmap and Hosts point at the current language, which defaults to Egyptian Arabic, the only available language, until language selection exists.
- Spanish has no learning pages; its learning URL shows a "coming soon" notice. Joining its waitlist is out of scope here and belongs to a later spec.
- Real content, accounts and sign-in, video playback, hours tracking and payments are out of scope. Placeholder pages show only a heading and a short "coming soon" note.
- Text direction in the language data is either right-to-left or left-to-right. Other values are invalid.
- The interface is English and left-to-right only.
- Footer links to pages not yet built (About, Privacy) may be shown as inactive text or omitted until those pages exist.
