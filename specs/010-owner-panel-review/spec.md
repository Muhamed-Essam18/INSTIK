# Feature Specification: Owner Panel: Review, Transcripts and Creators

**Feature Branch**: `010-owner-panel-review` (work continues on `develop`; no branch hook is registered)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Spec 10: the owner panel. Review queue, oldest first, with counts for needs review, transcript in progress, waiting on creator and approved this month. Review screen: play the video, a review checklist, set the final stage (pre-filled from the creator's proposed stage) and access (free or full), and write the transcript (time-coded segments with Arabic with tashkeel, transliteration and English, import a .vtt, link words to the glossary). Actions: Approve and publish (only when the checklist is complete and the transcript exists), Request changes, Reject. A note is required for the last two. Approving makes the video visible to learners right away. The creator gets an email for every decision, and sees it in My videos. Creators page: invite, resend an invite, pause and resume a creator (a paused creator cannot upload, and their live videos stay up), and per-creator stats. Out of scope: earnings and the creator dashboard."

## Clarifications

### Session 2026-11-13

- Q: Should the transcript save automatically or only on a Save button? → A: Each segment saves on its own as soon as it is valid, with a visible "Saved" indicator; there is no all-at-once Save button.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work through the review queue (Priority: P1)

An owner opens the Review queue and sees four counts: Needs review, Transcript in progress, Waiting on creator and Approved this month. Below them is a table of videos waiting on Instik, oldest submission first, showing title, creator, stage, length, submitted date, how long it has waited and a status badge. Each row has a button to open it ("Review", or "Continue" when a transcript is already under way).

**Why this priority**: The queue is the owner's entry point; nothing can be reviewed without it.

**Independent Test**: With videos In review (some with partial transcripts), Changes requested and Approved, open the queue and check the counts, the order and each row.

**Acceptance Scenarios**:

1. **Given** several videos In review, **When** the owner opens the queue, **Then** they are listed oldest submission first, each with creator, proposed stage, length, submitted date and days waiting ("Today", "1 day", "4 days").
2. **Given** a video In review with no transcript saved, **Then** its badge is "Needs review" and its button says "Review". **Given** one In review with some transcript saved, **Then** its badge is "Transcript in progress" and its button says "Continue".
3. **Given** videos in the system, **Then** the four counts match: Needs review and Transcript in progress count videos In review by those two badges; Waiting on creator counts videos in Changes requested; Approved this month counts videos approved since the start of the current calendar month in the Europe/Warsaw time zone.
4. **Given** an empty queue, **Then** the owner sees a calm "Nothing waiting" message and the counts still show.
5. **Given** a learner, a creator or a signed-out visitor, **When** they open the queue, **Then** they are turned away or asked to sign in (existing role rules).
6. **Given** the Waiting on creator count, **When** the owner follows it, **Then** they see the videos in Changes requested, oldest first, and can open each one read-only (no checklist, transcript or decision controls change anything).

---

### User Story 2 - Review a video and write its transcript (Priority: P1)

The owner opens a video. They see the video playing, the creator, proposed stage and submission date, and a review checklist (stage fits; clear audio and no lyrics music; real person, real place, no AI faces; nothing unsafe or off-brand; transcript written and checked). They set the final stage (pre-filled from the creator's proposal) and access (Free or Full). They write the transcript as time-coded segments, each with Arabic with tashkeel, transliteration and English; they can add segments, import a .vtt file for the timing and text, and link words in a saved segment to the glossary. Everything is saved so they can leave and come back.

**Why this priority**: Without a transcript and a review nothing can go live, and creators never write transcripts.

**Independent Test**: Open a video In review, tick checklist items, change stage and access, add segments by hand and via a .vtt import, link a word to the glossary, leave the page and return: everything is still there.

**Acceptance Scenarios**:

1. **Given** a video In review, **When** the owner opens it, **Then** it plays in the page (including videos that need signed playback) and shows its details.
2. **Given** the creator proposed a stage, **Then** the final stage is pre-filled with it and can be changed; access starts as Full access unless the owner picks Free.
3. **Given** the owner adds a segment, **Then** they enter a start and end time and Arabic (with tashkeel), transliteration and English; the Arabic field is right-to-left and uses the Arabic transcript font.
4. **Given** a valid .vtt file, **When** the owner imports it, **Then** its cues become segments with times and text; imported text lands in the Arabic field unless the owner edits it; existing segments are never silently overwritten (the owner chooses to add or replace and is told how many segments result).
5. **Given** a malformed .vtt file, **Then** the import is refused with a plain message and nothing changes.
6. **Given** a saved segment, **When** the owner taps a word, **Then** they see whether it is linked to a glossary entry of the video's language (words are linked by matching the glossary, ignoring tashkeel); a linked word shows its entry and can be corrected, and an unlinked word can be added to the glossary (word, meaning, transliteration), after which it is linked here and in every video of that language.
7. **Given** overlapping times, an end before a start, or a segment with empty Arabic, **Then** it is flagged and cannot be saved until fixed.
8. **Given** the owner edits a segment, **When** it becomes valid, **Then** it saves on its own and a "Saved" indicator confirms it; an invalid segment shows what to fix and is not saved. **Given** the owner leaves and returns, **Then** checklist ticks, stage, access and all saved segments are as they left them.
9. **Given** two owners open the same video, **Then** the later save does not silently overwrite the earlier one; the second owner is told the transcript changed and can reload.

---

### User Story 3 - Decide: approve and publish, request changes, or reject (Priority: P1)

At the bottom of the review screen the owner has a note box and three actions. **Approve and publish** is enabled only when every checklist item is ticked and at least one complete transcript segment exists. **Request changes** and **Reject** each require a note. Approving makes the video visible to learners at once, with the final stage and access chosen. Requesting changes returns it to the creator; rejecting closes it.

**Why this priority**: Decisions are the point of the panel.

**Independent Test**: Approve a ready video and see it in the learner library immediately; request changes and reject other videos with and without notes.

**Acceptance Scenarios**:

1. **Given** an incomplete checklist or no transcript, **Then** Approve and publish is disabled and a line explains why in kind words. The same rule is enforced on the server if the button is bypassed.
2. **Given** a complete checklist and a transcript, **When** the owner approves, **Then** the video becomes Approved with the final stage and access, appears in the library, search, host page and Up next without delay, and plays with its transcript.
3. **Given** an empty or whitespace-only note, **When** the owner chooses Request changes or Reject, **Then** the action is refused with a message and nothing changes.
4. **Given** a note, **When** the owner requests changes, **Then** the video moves to Changes requested and the creator sees the note in My videos and on the video status page, and may upload a new version (spec 9).
5. **Given** a note, **When** the owner rejects, **Then** the video moves to Rejected, is never visible to learners and the creator sees the note.
6. **Given** another owner already decided, or the video is not In review, **Then** the action is refused calmly and the screen shows the current status.
7. **Given** any decision, **Then** a status history entry records the previous and new status, the owner, the time and the note (the note is optional on approve and, if given, is shown to the creator).
8. **Given** a creator resubmits a video after changes, **Then** it returns to the queue with the checklist cleared and keeps any transcript already written, labelled "Needs review" or "Transcript in progress" according to whether a transcript exists.

---

### User Story 4 - Creators are told about every decision (Priority: P2)

Whenever an owner approves, requests changes or rejects a video, the creator receives an email and sees the same decision and note in My videos and on the video status page.

**Why this priority**: Creators otherwise have to keep checking; it is valuable but secondary to making decisions possible.

**Independent Test**: Decide one video of each kind and check the creator's inbox and My videos.

**Acceptance Scenarios**:

1. **Given** a decision, **Then** one email goes to the creator's address naming the video and the outcome, with the owner's note for changes and rejection (and for approval if one was given), and a link to My videos. Tone is kind, short and never shaming.
2. **Given** an approval, **Then** the email says the video is live.
3. **Given** the email cannot be sent, **Then** the decision still stands, the failure is recorded and the owner is told the email did not go out so they can follow up.
4. **Given** the same decision is submitted twice (double click, retry), **Then** only one email is sent.
5. **Given** any decision, **Then** the creator's My videos list shows the new status and the shortened latest note without waiting for the email.

---

### User Story 5 - Invite and manage creators (Priority: P2)

On the Creators page an owner invites a creator by name and email, sees all creators and invitees in one table (name, status Active / Invited / Paused, videos live, videos in review, videos with changes requested) and can resend an invite, pause a creator, resume a creator and open a creator's stats.

**Why this priority**: Needed to grow the programme, but reviewing existing uploads matters first.

**Independent Test**: Invite a new email, resend, accept as that person, pause them, check they cannot upload but their live videos still play, resume.

**Acceptance Scenarios**:

1. **Given** a name and valid email, **When** the owner sends an invite, **Then** the spec 8 invitation is created and emailed (one-time link, 7 days) and the person shows as Invited. An email that already belongs to an owner or creator is refused with a clear message.
2. **Given** an Invited person, **When** the owner chooses Resend, **Then** a fresh link is emailed and the earlier link stops working (superseded), with a new 7-day expiry. An expired invite shows as Invited with an "Expired" mark and can be resent.
3. **Given** an Active creator, **When** the owner pauses them, **Then** their status is Paused; they cannot start an upload, save a draft, submit a video or edit their host page; they can still sign in, read their panel and statuses and notes; they are not otherwise notified by this feature.
4. **Given** a paused creator with Approved videos, **Then** those videos stay live and playable and their host page stays up.
5. **Given** a paused creator with videos already In review or Changes requested, **Then** they stay in the queue and owners can still decide them; creators cannot resubmit until resumed.
6. **Given** a paused creator, **When** the owner resumes them, **Then** they can upload and submit again, with their drafts intact.
7. **Given** a creator, **When** the owner opens their stats, **Then** they see counts of videos by status (Draft, In review, Changes requested, Approved, Rejected), videos approved this month, last upload date and joined date.
8. **Given** pausing or resuming, **Then** the change is recorded with who and when, and takes effect on the creator's next request without them signing out.
9. **Given** a non-owner, **Then** none of these actions is reachable, even by direct request.

---

### Edge Cases

- A video still Processing or in Draft is not in the queue and cannot be reviewed or approved.
- Approving a video whose playback is not ready is refused with a plain message.
- A very long transcript (hundreds of segments) stays usable: saving does not lose work and the page remains responsive.
- A .vtt with cue settings, styling tags or multiple lines per cue: tags are stripped, lines joined, and the owner sees a summary before confirming.
- Arabic pasted without tashkeel is accepted but the owner sees a gentle reminder; with tashkeel it is stored exactly as typed.
- Changing the stage or access after ticking the checklist keeps the ticks; the final values on approval are what is shown on the screen at that moment.
- A creator who is paused while a draft upload is in progress cannot submit it; the file already uploaded is kept.
- An invite for an email already invited and pending, or belonging to an owner or creator, is handled by the spec 8 rules (superseded or refused with a clear message).
- A creator's account removed while videos are in review: the videos stay reviewable; the email to them is recorded as not delivered.
- Two owners acting at once: exactly one decision succeeds.

## Requirements *(mandatory)*

### Functional Requirements

**Review queue**

- **FR-001**: The owner area MUST include a Review queue page listing every video In review, oldest submission first, with title, creator, proposed stage, length, submitted date, days waiting and a status badge.
- **FR-002**: The page MUST show four counts: Needs review (In review, no transcript segments yet), Transcript in progress (In review, at least one segment saved), Waiting on creator (Changes requested) and Approved this month (approved since the first day of the current calendar month, in the Europe/Warsaw time zone, the same zone spec 11 will use for earnings months).
- **FR-003**: Each row MUST open that video's review screen. The "Waiting on creator" count MUST link to a list of the videos in Changes requested (oldest first, same columns), each opening its review screen read-only; videos not In review MUST NOT be decidable.

**Review screen**

- **FR-004**: The review screen MUST play the video with the same access rules as the learner player for its access type, and MUST show creator, proposed stage and submission date.
- **FR-005**: It MUST provide a review checklist of five items: stage fits; clear audio and no lyrics music; real person, real place, no AI faces; nothing unsafe, offensive or off-brand; transcript written and checked. Ticks MUST be saved per video and cleared when the creator resubmits.
- **FR-006**: It MUST let the owner set the final stage (pre-filled from the creator's proposed stage) and access (Free or Full), limited to existing stages and the two access values.
- **FR-007**: The transcript editor MUST support time-coded segments each with Arabic with tashkeel, transliteration and English, add, edit, reorder by time and delete of segments, with Arabic fields right-to-left and the target-language attributes the platform already uses.
- **FR-008**: The editor MUST validate segments: start before end, no overlaps, within the video's duration, Arabic required; invalid segments MUST NOT be saved.
- **FR-009**: The editor MUST import a .vtt file, creating segments from its cues, MUST refuse malformed files without changes, and MUST let the owner choose between adding to or replacing existing segments, with a count shown first.
- **FR-010**: Owners MUST be able to see which words in a saved segment are linked to the video's language glossary, add a glossary entry for an unlinked word (which links that word wherever it appears in that language), and correct an entry's meaning or transliteration. Linking MUST follow the platform's existing glossary matching (ignoring tashkeel); an entry whose word already matches an existing entry MUST be refused with the existing entry shown. Per-occurrence unlinking and deleting entries are out of scope.
- **FR-011**: Stage, access, checklist and transcript MUST persist across visits, and concurrent edits MUST NOT silently overwrite each other. Each transcript segment MUST save automatically as soon as it is valid, with a visible "Saved" or "Not saved yet" indicator, and a save failure MUST be shown plainly without discarding the owner's text.

**Decisions**

- **FR-012**: The screen MUST offer Approve and publish, Request changes and Reject.
- **FR-013**: Approve and publish MUST be possible only when all checklist items are ticked, at least one transcript segment exists, the video is In review, and everything the learner site needs to show it is present; the server MUST enforce this, and the screen MUST explain why it is disabled.
- **FR-014**: Request changes and Reject MUST require a non-empty note, enforced on the server.
- **FR-015**: Approving MUST set the final stage and access, move the video to Approved, and make it visible to learners immediately, with its transcript and glossary links, everywhere the learner site lists or plays Approved videos.
- **FR-016**: Each decision MUST follow the allowed status path from spec 8, record a status history entry (previous and new status, owner, time, note) and be refused if the video is no longer In review; exactly one of two simultaneous decisions MUST succeed.
- **FR-017**: A rejected video MUST stay hidden from learners and cannot be reopened by anyone in this spec.

**Creator communication**

- **FR-018**: Every decision MUST send the creator one email naming the video and outcome, including the note when there is one and a link to My videos. Repeated submissions of the same decision MUST NOT send duplicates.
- **FR-019**: A failure to send MUST NOT undo the decision; it MUST be recorded and shown to the owner.
- **FR-020**: Decisions and their notes MUST appear in the creator's My videos list and video status page (existing from spec 9) as soon as they are made.

**Creators page**

- **FR-021**: The owner area MUST include a Creators page with an invite form (name, email) and a table of all creators and invitees with status Active, Invited or Paused, videos live, videos in review and videos with changes requested.
- **FR-022**: Inviting MUST use the spec 8 invitation rules (one-time link, 7-day expiry, email contains only link, team name and invited name; refusal for existing owner or creator emails).
- **FR-023**: Resend MUST issue a new link with a fresh 7-day expiry, invalidate the earlier link, and be available for pending and expired invites.
- **FR-024**: Owners MUST be able to pause and resume a creator. While paused, the creator MUST NOT be able to start an upload, save or edit a draft video, submit or resubmit a video, or edit their host page (they can still read it); this MUST be enforced on the server on every such request.
- **FR-025**: Pausing MUST NOT change any Approved video, host page, or learner-facing data; it MUST NOT remove videos already In review or Changes requested from the owner's queue.
- **FR-026**: Pause and resume MUST be recorded with who and when and take effect on the creator's next request.
- **FR-027**: Each creator MUST have a stats view with video counts by status, videos approved this month, joined date and last upload date.

**Access and safety**

- **FR-028**: Every owner page and action MUST be reachable only by owners, checked on the server on every read and write; learners, creators and signed-out visitors MUST be refused.
- **FR-029**: Owner decisions, pause/resume and invitations MUST be covered by automated tests that include a creator attempting each action.
- **FR-030**: The owner panel MUST follow the approved designs (Review queue, Review and transcript, Creators) and the brand voice: short, warm, never shaming; interface in English, left-to-right.

### Key Entities

- **Review item**: a video In review or Changes requested, with creator, proposed stage, length, submission date and review badge.
- **Review checklist**: five ticks per video review, saved, cleared on resubmission.
- **Final classification**: the stage and access chosen by the owner, starting from the creator's proposed stage.
- **Transcript segment**: time range with Arabic with tashkeel, transliteration and English; linked words refer to glossary entries.
- **Glossary entry**: per-language word with meaning, transliteration and optional audio.
- **Decision**: approve, request changes or reject; carries owner, time, note and the status history entry.
- **Decision email**: one per decision to the creator, with delivery outcome recorded.
- **Creator state**: Invited, Active or Paused, with who and when for each pause or resume.
- **Creator invitation**: as defined in spec 8, plus resend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can open a queued video, finish a ready review and approve it in under 3 minutes when the transcript is already written.
- **SC-002**: An owner can turn an existing .vtt file into a complete, saved transcript for a 6-minute video in under 15 minutes, including linking at least 10 words to the glossary.
- **SC-003**: In tests, 100% of attempts to approve with an incomplete checklist or no transcript, and 100% of attempts to request changes or reject without a note, are refused with no change to the video.
- **SC-004**: After approval, the video appears in the learner library and plays with its transcript within 5 seconds, and 0 non-approved videos are ever visible to learners.
- **SC-005**: 100% of decisions produce exactly one status history entry and exactly one creator email (or a recorded failure), including when the action is repeated.
- **SC-006**: The four queue counts match the underlying videos in 100% of test cases, and the table is always ordered oldest submission first.
- **SC-007**: A paused creator is refused on 100% of upload, draft and submit attempts within one request of being paused, while 100% of their Approved videos stay playable.
- **SC-008**: A resent invitation works exactly once within 7 days and the previous link is refused in 100% of tests.
- **SC-009**: In role tests, 100% of attempts by learners, creators and signed-out visitors to reach any owner page or action are refused.
- **SC-010**: In a test with two owners deciding the same video at once, exactly one decision succeeds in 100% of runs.

## Assumptions

- Specs 8 and 9 are in place: roles, invitations, the status model and its history, creator panel, My videos with notes, and the creator's proposed stage on each video.
- "Transcript in progress" and "Needs review" are display states of In review, derived from whether any transcript segment exists; they are not new video statuses. "Waiting on creator" counts Changes requested.
- Review checklist ticks are saved on the video's current review round and cleared on resubmission; the transcript is kept across rounds.
- The checklist item "Transcript written and checked" is ticked by the owner; the server separately requires at least one saved segment. It does not require the transcript to cover the whole video.
- .vtt files carry timing and one text track; imported text goes to the Arabic field and the owner fills transliteration and English by hand. Automatic translation or transliteration is out of scope.
- New glossary entries created in the editor may be saved without audio; adding audio is out of scope. Word links are not stored per segment: the learner site already links words by matching the glossary, so "link words to the glossary" means keeping the glossary complete and showing the owner which words match.
- A note on approval is optional; if given, it is shown to the creator.
- Pausing a creator does not send an email; only decisions do.
- "Per-creator stats" are content counts only (videos by status, approved this month, joined, last upload). Counted views, watch hours, completion and earnings need statistics from a later spec.
- The Creators page lists Egyptian Arabic creators only at launch, matching the design; multi-language filtering comes with more languages.
- Revoking an invite already exists from spec 8 and is not re-specified here.
- Desktop first; the panel stays usable on a phone but is not optimised for transcript writing there.

**Out of scope**: earnings and statements, the creator dashboard and statistics (views, watch hours, completion), new versions of Approved videos, deleting or reopening Rejected videos, automatic transcription or translation.
