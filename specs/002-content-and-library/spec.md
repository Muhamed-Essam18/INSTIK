# Feature Specification: Content and Library

**Feature Branch**: `002-content-and-library`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Spec 2: content and library. File-based content per language (videos, transcripts, glossary, hosts) validated at build time; Egyptian Arabic sample content; Library screen; Host page; video cards link to the player page (player is spec 3)."

## Clarifications

### Session 2026-11-05

- Q: When a learner types in the search box, should results come from all stages, or only from the selected stage? → A: A non-empty search looks across all stages and topics, and each card shows its stage; clearing the search returns to the stage and topic view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Library and find a video (Priority: P1)

A learner opens the Library for Egyptian Arabic. They see a "Pick up where you left off" banner, a heading, a search box, stage and topic filters, a count line, and a grid of video cards. Each card shows the stage, title, length, host and a slot for a "Watched" label. The list ends with a calm end message. There is no infinite scroll or "load more".

**Why this priority**: The Library is the learner's front door to all content. Without it nothing else in the product can be reached.

**Independent Test**: Open the Library with the sample content. Confirm the banner, filters, cards and end message match the approved design, and that the page works without any account or playback.

**Acceptance Scenarios**:

1. **Given** sample content with videos at three stages, **When** the learner opens the Library, **Then** they see the pick-up banner, the filters, the count line and cards for the selected stage, followed by the end message.
2. **Given** a stage with no videos (Join in), **When** the learner selects it, **Then** they see "No videos at Join in yet. They are on the way." and no cards, and the page still ends cleanly.
3. **Given** the Library is showing cards, **When** the learner scrolls to the bottom, **Then** no further videos load; the page ends with the end message.
4. **Given** a card, **When** the learner activates it, **Then** they go to the player page address for that video.
5. **Given** any card, **Then** its host name is visible.

---

### User Story 2 - Filter and search (Priority: P1)

The learner narrows the list by stage and topic, and by typing in the search box. Search ignores tashkeel (Arabic diacritics) and treats Arabic letter variants (such as أ, إ, آ and ا) as the same letter, so typing without marks or with a different alef form still finds the video.

**Why this priority**: Filters and search are how learners reach the right level quickly; Arabic-aware matching is core to the product's multi-language rules.

**Independent Test**: With sample content, select each stage and topic, then search Latin and Arabic terms with and without tashkeel and with different alef forms; verify the correct cards remain.

**Acceptance Scenarios**:

1. **Given** the Library, **When** the learner selects a stage, **Then** only videos at that stage are listed and the count line updates.
2. **Given** a stage is selected, **When** the learner selects a topic, **Then** only videos matching both stage and topic are listed; selecting the topic again clears it.
3. **Given** a video whose searchable Arabic text contains tashkeel, **When** the learner searches the same word without tashkeel, **Then** the video is found.
4. **Given** a video containing a word with "أ", **When** the learner searches the same word using "ا" or "إ", **Then** the video is found.
5. **Given** a stage and topic are selected, **When** the learner types a non-empty search, **Then** results come from all stages and topics, each card shows its stage, and clearing the search returns to the stage and topic view.
6. **Given** a search that matches nothing, **When** results are empty, **Then** the learner sees a kind "nothing here" message instead of a blank page, and can clear the search.
7. **Given** a Latin search such as "cafe", **When** a title is "At the café", **Then** it matches regardless of accents and letter case.

---

### User Story 3 - Visit a host page (Priority: P2)

The learner opens a host page from a card or the Hosts nav item. They see a photo placeholder, the host's name in Latin and Arabic, a short story, topic chips, the videos with this host, and other hosts. Each host has its own address under the hosts section of the language.

**Why this priority**: Every video shows its host, and the product promises real people; the host page makes that promise tangible. It depends on the content model from Story 4 but is independently viewable.

**Independent Test**: Open each sample host's address directly. Confirm layout and content match the design and that videos listed belong to that host only.

**Acceptance Scenarios**:

1. **Given** a host with videos, **When** the learner opens their page, **Then** they see the photo placeholder, Latin name, Arabic name (right-to-left, Arabic-tagged), story, topics, and only that host's videos.
2. **Given** two hosts, **When** viewing one, **Then** the other appears under "Other hosts" and links to their page, along with a "More hosts joining soon" placeholder.
3. **Given** an address for a host that does not exist, **When** opened, **Then** the learner sees a friendly not-found page.
4. **Given** a host page, **When** the learner activates a video card, **Then** they go to that video's player page address.

---

### User Story 4 - Author and validate content as files (Priority: P1)

A content editor adds or edits videos, transcripts, hosts and the glossary as plain files in a per-language folder. When the site is built, every file is checked; any problem stops the build with a message naming the file and the fault.

**Why this priority**: There is no admin panel; files are the only authoring path, and broken content must never reach learners.

**Independent Test**: Introduce each kind of defect in a copy of the sample content (missing field, unknown host, duplicate slug, bad stage, malformed transcript) and verify the build fails with a clear message; revert and verify it passes.

**Acceptance Scenarios**:

1. **Given** valid content, **When** the site is built, **Then** the build succeeds.
2. **Given** a video file missing a required field, with an unknown stage, or with an access value other than free or full, **When** built, **Then** the build fails and names the file and field.
3. **Given** a video that references a host that does not exist, **When** built, **Then** the build fails.
4. **Given** two videos with the same slug, or a slug that differs from its file name, **When** built, **Then** the build fails.
5. **Given** a transcript file that is not valid timed text or has no matching video, **When** built, **Then** the build fails.
6. **Given** a malformed glossary or host file, **When** built, **Then** the build fails.

---

### User Story 5 - Egyptian Arabic sample content (Priority: P2)

The project ships clearly marked sample content for Egyptian Arabic so the Library and host pages can be seen and tested.

**Why this priority**: Needed to demonstrate and verify everything above, but replaceable by real content later.

**Independent Test**: Count and inspect the sample files.

**Acceptance Scenarios**:

1. **Given** the sample content, **Then** there are about 8 videos spread across Hear it, Follow it and Understand it, 2 hosts, and 2 short transcripts.
2. **Given** the sample content, **Then** it is clearly marked as sample (in the files, so no one mistakes it for final content).
3. **Given** videos without a transcript, **Then** they still load in the Library and validate correctly.

---

### Edge Cases

- A video has no transcript: allowed; the transcript is optional per video, but one that exists must be valid and match a video.
- A host has no videos yet: the host page shows a kind empty message in the videos section.
- The language has a single host: the sections still render; "Other hosts" shows only the "More hosts joining soon" placeholder.
- Search text is only whitespace, only tashkeel, or very long: treated as empty or handled without errors.
- Stage "Join in" has no launch content: shows the empty state, not an error.
- Free versus full access: stored as a field, but no gating happens in this feature.
- Narrow phone widths: filters wrap, cards form a single column, nothing scrolls sideways.
- The "Watched" slot is empty for everyone; it does not reserve awkward blank space.
- Topic or stage names in content that are not in the allowed lists cause a build failure rather than silently disappearing from filters.

## Requirements *(mandatory)*

### Functional Requirements

**Content files and validation**

- **FR-001**: Content MUST live as files under a per-language folder: one metadata file per video, one timed-text transcript per video (optional per video), one glossary file, and one file per host.
- **FR-002**: Each video file MUST carry title, slug, stage, topic, host, duration, access (free or full) and, once the video is uploaded, a video playback id (optional until then; amended in spec 003). The language and variety come from the folder and the language registry.
- **FR-003**: Each host file MUST carry name, Arabic name, story, topics and a photo reference (a placeholder is acceptable).
- **FR-004**: All content MUST be validated during build. Any invalid content (missing or malformed fields, unknown stage or topic, access value not free or full, duplicate or mismatched slug, unknown host, orphan or malformed transcript, malformed glossary) MUST fail the build with a message that names the file and the problem.
- **FR-005**: Stage values MUST be limited to Hear it, Follow it, Understand it and Join in. Internal content levels MUST NOT appear in learner-facing text or in content fields shown to learners.
- **FR-006**: Arabic text in content MUST be stored with tashkeel intact; display uses the stored form.
- **FR-007**: Adding another language's content MUST require only adding files and registry data, not changing Library or host page code.

**Sample content**

- **FR-008**: The project MUST include Egyptian Arabic sample content: about 8 videos across Hear it, Follow it and Understand it, 2 hosts, 2 short transcripts, and a glossary covering the transcript words.
- **FR-009**: Sample content MUST be clearly marked as sample inside the files themselves.
- **FR-010**: Sample videos and hosts SHOULD reuse the titles and hosts in the approved designs (for example Salma and Omar, "At the café").

**Library screen**

- **FR-011**: The Library MUST match the approved design in layout, spacing, colours, type and copy, using the shared header and navigation, with Library marked as the current page.
- **FR-012**: The Library MUST show a "Pick up where you left off" banner with a "Keep watching" action. For now its content is static and it links to the player page of the sample video it names.
- **FR-013**: The Library MUST offer stage filters (Hear it, Follow it, Understand it, Join in) and topic filters, and a count line that reflects the current result, with the "Your stage is …" sentence static for now.
- **FR-014**: Search MUST match titles and host names across all stages, ignoring tashkeel, treating Arabic letter variants (at minimum أ, إ, آ, ا, and also ى/ي and ة/ه) as equivalent, and ignoring case and Latin accents.
- **FR-015**: Stage and topic filters MUST combine (both apply) and update the list without leaving the page. A non-empty search MUST look across all stages and topics (filters are set aside while searching), and clearing the search MUST restore the selected stage and topic view. The count line MUST reflect search results while searching.
- **FR-016**: Each video card MUST show stage, title, duration in minutes, host name and an empty "Watched" label slot, and MUST link to that video's player page address.
- **FR-017**: The list MUST end with the end message and MUST NOT use infinite scroll, auto-loading or "load more". When a filter or search yields nothing, a kind empty message MUST appear.
- **FR-018**: Language-specific text in cards (such as an Arabic title, if shown) MUST carry its own direction and language attributes.

**Host page**

- **FR-019**: Each host MUST have its own address under the language's hosts section, and the Hosts nav item MUST lead to the hosts section.
- **FR-020**: The host page MUST match the approved design: photo placeholder, "Host · Egyptian Arabic" label, Latin name, Arabic name (right-to-left, Arabic-tagged), story, topic chips, a "Watch … say hello" action, "Videos with …", and "Other hosts" with a "More hosts joining soon" placeholder.
- **FR-021**: The host page MUST list only that host's videos, and each links to the player page address. "Other hosts" MUST list every other host in that language and link to their pages.
- **FR-022**: Unknown host addresses MUST show a friendly not-found page.

**Quality**

- **FR-023**: Pages MUST be keyboard-operable, meet the project's accessibility and contrast standards, have visible focus, and work from phone to desktop widths without sideways scrolling.
- **FR-024**: Learner copy MUST follow the brand voice, and every video shown MUST show its host.

### Key Entities

- **Language**: A learning language registered in the project data, with its folder of content. Egyptian Arabic is the only one with content now.
- **Video**: A levelled video with title, slug, stage, topic, host, duration, access and playback id; belongs to one language and one host.
- **Transcript**: Time-synced text for one video, stored next to it; optional; can mark itself as sample.
- **Glossary**: Per-language list of words with tashkeel, base form, transliteration, English meaning and optional audio, used by transcripts later.
- **Host**: A real native-speaker presenter with Latin and Arabic names, story, topics and photo reference.
- **Stage / Topic**: The four learner-facing stages and the fixed list of topics used for filtering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can find a specific sample video via stage, topic or search in under 15 seconds.
- **SC-002**: Searching any sample Arabic term with tashkeel removed, or with any alef variant swapped, returns the same videos as the exact form in 100% of tested cases.
- **SC-003**: Every one of the deliberate defect types listed in User Story 4 causes the build to fail with a message naming the problem file; valid content builds successfully.
- **SC-004**: All sample Library and host pages visually match the approved designs in a side-by-side review with no unresolved differences in layout, copy or colours at desktop and phone widths.
- **SC-005**: Every video card is one action away from its player page address, and every host page address in the sample content loads.
- **SC-006**: No Library or host page loads more content as the learner scrolls; every list shows its end.
- **SC-007**: The Library and host pages pass the project's automated accessibility checks with no serious issues.
- **SC-008**: A new video, host or transcript can be added by creating files only, and appears in the Library after a rebuild without code changes.

## Assumptions

- `docs/roadmap.md` was not found in the repository; "Spec 2" is taken as the content-and-library step following spec 001 (foundation).
- Addresses follow the language-in-URL rule: the Library at `/learn/arabic-egyptian`, hosts under `/learn/arabic-egyptian/hosts/<host-slug>`, and player pages under `/learn/arabic-egyptian/watch/<video-slug>`. The player page itself arrives in spec 3, so until then these addresses may show a placeholder.
- The default selected stage in the Library is "Follow it", matching the design; the stage buttons are single-select as in the design.
- The topic list is the five in the design (Daily life, Food, Family, Getting around, Culture); each video has one topic.
- Each video has one host; thumbnails and host photos are placeholders in this feature.
- The pick-up banner uses fixed sample content ("At the café", 2:14 of 8:40, with Salma) and is replaced by real watch history in a later spec.
- The "Hours" chip and account button in the design header are outside this feature; only what spec 001 already provides is reused.
- Access (free or full) is stored and validated but not enforced here; accounts and pricing come later.
- Video playback, accounts, real watch history and hours are out of scope.
- Dependency: the app shell and design tokens from spec 001.
