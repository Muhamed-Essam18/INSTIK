# Feature Specification: Creator Panel and Video Upload

**Feature Branch**: `009-creator-panel-upload`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Spec 9: the creator panel and video upload. The creator panel layout from the designs, with Dashboard (empty for now), Upload a video, My videos and My host page. Upload: the file goes straight from the browser to our video host with a visible progress bar; then title, stage, topic, language and description; a pre-submit checklist; Save draft and Submit for review. Creators never write transcripts. The video moves through Uploading and Processing automatically, then waits in In review once submitted and ready. My videos lists every video with status filters, its latest note from Instik and its views slot. The video status page shows the note, the full history, and lets the creator upload a new version when changes are requested, which sends it back to review. Creators can edit their host page: photo, name in Latin and Arabic, short story and topics. Out of scope: owner review screens, statistics and earnings."

## Clarifications

### Session 2026-11-13

- Q: Should a new version return to review automatically once processed, or after the creator submits again? → A: The creator submits again (checklist re-ticked). The video stays in Changes requested the whole time; the new file is held as a pending version (shown as "New version processing" or "New version ready to submit", with the note still visible) and replaces the current file only when resubmitted.
- Q: Can a creator delete a draft or withdraw a submission? → A: Drafts can be deleted by their creator (hidden everywhere, history kept, uploaded file deleted); videos in review or approved cannot be deleted or withdrawn.
- Q: What can a creator do with a Rejected video? → A: Nothing beyond reading the note and history; rejection is final and they start a new video.
- Q: Must the host page be complete before a video can be submitted? → A: Yes: photo, both names and short story; drafts are unaffected.
- Q: Who sets a video's stage? → A: The creator proposes a stage; the final stage is set by the owner in review (spec 10), pre-filled from the proposal.
- Q: When does an abandoned upload show as "Upload didn't finish"? → A: After the upload link's lifetime (1 hour) plus 15 minutes.
- Q: What are the file limits? → A: Files over 4 GB are refused before uploading; a video longer than 30 minutes goes back to Draft after processing with a plain note.
- Q: What happens to new versions of Approved videos? → A: Out of scope; Approved videos have no way back to the creator in this spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a video and submit it for review (Priority: P1)

A creator opens "Upload a video", drops in a video file and watches a progress bar while it goes to the video host. While it uploads they fill in title, stage, topic, language and description. They tick the pre-submit checklist and choose "Submit for review" (or "Save draft" to come back later). No transcript is asked for: the page says Instik writes it.

**Why this priority**: It is the reason the creator programme exists. Without it no new content can reach learners.

**Independent Test**: As a creator, upload a sample video, fill the form, tick the checklist and submit. Confirm the video appears in My videos and ends up In review once processing finishes.

**Acceptance Scenarios**:

1. **Given** a signed-in creator on the upload page, **When** they choose or drop an MP4 or MOV file, **Then** the upload starts at once and a progress bar shows the percentage until it completes.
2. **Given** an upload in progress, **When** the creator fills in the details, **Then** they can do so without waiting for the upload to finish.
3. **Given** the form is incomplete or any checklist item is unticked, **When** the creator tries to submit, **Then** submission is blocked and the missing items are named kindly. Save draft is still allowed with only partial details.
4. **Given** the upload has finished and processing is not yet done, **When** the creator submits, **Then** the submission is accepted and the video shows as Processing, then moves to In review automatically as soon as it is ready.
5. **Given** the upload has finished and processing is already done, **When** the creator submits, **Then** the video goes straight to In review.
6. **Given** a draft, **When** the creator returns later from My videos, **Then** their details are kept and they can continue and submit.
7. **Given** the connection drops or the file is rejected, **When** the upload fails, **Then** the creator sees a plain message and can retry without losing the details they typed.
8. **Given** the page, **When** read by the creator, **Then** it contains no transcript field and states that Instik writes the transcript.
9. **Given** a file over 4 GB, **When** the creator chooses it, **Then** it is refused before uploading with a plain message. **Given** a processed video longer than 30 minutes, **Then** it returns to Draft with a plain note and the creator can upload a shorter file.

---

### User Story 2 - See all my videos and where each one stands (Priority: P1)

The creator opens "My videos" and sees every video they have made, with title, stage, status, the latest note from Instik, a views slot and the last update date. Filters let them show All, In review, Changes requested, Live or Drafts, each with a count.

**Why this priority**: It is how creators learn what needs their attention.

**Independent Test**: With videos in several statuses, open My videos, check counts and rows, and switch each filter.

**Acceptance Scenarios**:

1. **Given** a creator with videos in different statuses, **When** they open My videos, **Then** every one of their videos is listed, newest update first, with the counts on the filters matching the rows.
2. **Given** a video whose latest status change carries a note, **When** listed, **Then** the note is shown shortened; with no note a dash is shown.
3. **Given** videos that are not live, **When** listed, **Then** the views slot shows a dash; for live videos it shows a placeholder until statistics exist.
4. **Given** a video that is uploading or processing, **When** listed, **Then** it shows those statuses (they count toward All only). A video that has finished processing but is not yet submitted shows "Ready to submit" and counts under Drafts.
5. **Given** two creators, **When** either opens My videos, **Then** they see only their own videos.
6. **Given** a creator with no videos, **When** they open My videos, **Then** a calm empty state links to Upload a video.

---

### User Story 3 - Read Instik's note and send a new version (Priority: P2)

The creator opens a video's status page. They see its title, stage, topic and length, the current status, the note from Instik when there is one, and the full history (each step with date, who did it and any note). When changes were requested they can upload a new version, which sends the video back to review, or edit its details.

**Why this priority**: It closes the review loop, but it only matters once owners can review (spec 10).

**Independent Test**: Put a video in Changes requested with a note, open it as its creator, upload a new version, and confirm the history and status.

**Acceptance Scenarios**:

1. **Given** a video in Changes requested, **When** the creator opens it, **Then** the note from Instik is prominent and "Upload a new version" and "Edit details" are offered.
2. **Given** the creator uploads a new version, **When** it is uploading or processing, **Then** the video stays in Changes requested, shows "New version processing" and the note stays visible. **When** processing is done it shows "New version ready to submit". The creator re-ticks the checklist and presses "Submit for review"; the new file then becomes the video's file, the old file is deleted, the video goes to In review and the history records the new submission. Processing finishing before or after the press works as for a first submission.
3. **Given** a video in any other status (including Rejected and Approved), **When** the creator opens it, **Then** no upload-new-version action is offered, and Edit details is offered only for drafts and Changes requested.
4. **Given** a video that belongs to another creator, **When** a creator opens its address, **Then** it behaves like a missing page.
5. **Given** a video, **When** the history is shown, **Then** every status change is listed newest first with when, who (You or Instik) and the note.
6. **Given** a new version fails (upload error, upload that didn't finish, processing error or longer than 30 minutes), **When** the creator opens the video, **Then** the video is still in Changes requested with its earlier file, a plain message says the new version didn't work, and they can try again.

---

### User Story 4 - Creator panel layout and navigation (Priority: P2)

Creators get a panel that matches the approved designs: the instik creator wordmark, navigation with Dashboard, Upload a video, My videos and My host page, and "Signed in as" the creator's name. The Dashboard is an empty, friendly placeholder for now.

**Why this priority**: It frames the other stories. The empty pages from spec 8 become real.

**Independent Test**: Sign in as a creator, open each nav item, confirm the active item is marked and the Dashboard is a placeholder.

**Acceptance Scenarios**:

1. **Given** a creator, **When** they open the panel, **Then** the four navigation items appear and the current page is marked.
2. **Given** the Dashboard, **When** opened, **Then** it says statistics will appear once videos are live and points to Upload a video.
3. **Given** a learner who is not a creator, **When** they open any creator page, **Then** they are turned away as in spec 8.
4. **Given** a paused or removed creator, **When** they open the panel, **Then** the existing role rules apply unchanged.

---

### User Story 5 - Edit my host page (Priority: P3)

The creator edits the public host page that learners see: photo, name in Latin letters and in Arabic, a short story and their topics. Changes appear on the public page.

**Why this priority**: Useful and expected, but uploads can run without it.

**Independent Test**: Change each field, save, then open the public host page as a learner.

**Acceptance Scenarios**:

1. **Given** the host page form, **When** the creator saves a new Latin name, Arabic name, story and topics, **Then** the public host page shows them, the Arabic name displayed right-to-left.
2. **Given** a photo upload, **When** the file is not an image or is too large, **Then** it is refused with a plain message and the old photo stays.
3. **Given** a required field (names, story) left empty, **When** saving, **Then** the save is blocked with a clear message.
4. **Given** a creator, **When** they edit their host page, **Then** only their own page can be changed.
5. **Given** the creator has live videos, **When** they change their name, **Then** it updates wherever the host is shown.

### Edge Cases

- The creator closes the tab mid-upload: the video shows "Uploading" until the upload link has expired (1 hour) plus 15 minutes, then shows "Upload didn't finish" and the creator can start the upload again.
- The video host reports that a file could not be processed: the video shows an error state with a plain message and the creator can upload another file; the history records the failure.
- The creator submits, then the file turns out to be broken: it returns to a state where a new file can be uploaded, with an explanatory note.
- A creator double-clicks Submit, or submits from two tabs: only one submission is recorded.
- Very large files: upload continues in the background and tolerates a brief connection loss.
- The notification that a video is ready arrives twice or out of order: the video state stays correct and history is not duplicated.
- A creator attempts to change another creator's video or host page by editing an address or form: refused.
- An Arabic name with tashkeel or mixed text: stored and shown as typed.
- A language chosen is one that is not launched: only available languages can be picked.

## Requirements *(mandatory)*

### Functional Requirements

**Panel**

- **FR-001**: The creator panel MUST show the layout from the approved designs, with navigation items Dashboard, Upload a video, My videos and My host page, the active item marked, and the signed-in creator's name.
- **FR-002**: The Dashboard MUST be an empty placeholder that sets the expectation that statistics come later.
- **FR-003**: All panel pages and actions MUST be available only to creators; other roles are turned away.

**Upload**

- **FR-010**: Creators MUST be able to choose or drop one MP4 or MOV file, and the file MUST travel directly from the browser to the video host without passing through Instik's servers.
- **FR-011**: The upload MUST show a visible progress percentage and a clear completed or failed state, and MUST be retryable.
- **FR-012**: The form MUST collect title, stage, topic, language and short description, with stage and topic choices matching the platform's own lists and language limited to available languages. The stage the creator chooses is a proposal: the final stage is set by the owner in review (spec 10), pre-filled from the proposal.
- **FR-013**: The form MUST show the pre-submit checklist (real person on camera in a real place with natural light; quiet room and clear speech; pace of the chosen stage; no background music with lyrics; creator owns the video and its music and agrees to the creator terms). Submission MUST require every item ticked.
- **FR-014**: Creators MUST be able to save a draft at any time with partial details, and later continue it.
- **FR-015**: Submit for review MUST require title, stage, topic, language, description and a successfully uploaded file; otherwise it is blocked with specific messages. It MUST also require a complete host page (photo, Latin name, Arabic name and short story), otherwise blocked with a kind message linking to My host page. Saving drafts never requires it.
- **FR-016**: The system MUST NOT ask creators for a transcript and MUST say that Instik writes it.
- **FR-017**: A creator MUST only be able to start an upload for themselves, and the permission for one upload MUST be single-use. Starting an upload and submitting MUST pass one shared "may this person upload" check, which spec 10 extends so that a paused creator cannot upload or submit. Owners do not upload in this spec.
- **FR-018**: Files over 4 GB MUST be refused before the upload starts. A video longer than 30 minutes MUST be refused after processing: a first video returns to Draft with a plain system note in its history; a new version is discarded with a plain message on the page. In both cases the over-long file is deleted from the video host.

**Status flow**

- **FR-020**: A video MUST move automatically: Draft → Uploading when a file starts uploading → Processing when the upload completes → ready when the host finishes. Once the creator has submitted and the video is ready, it MUST move to In review.
- **FR-021**: If the creator submits before processing finishes, the submission MUST be remembered and the video MUST move to In review automatically when ready, without further action.
- **FR-022**: Only valid transitions MUST be possible; an invalid one MUST be refused and leave the video unchanged.
- **FR-023**: Every status change MUST be recorded in the history with who (creator, Instik system or owner), when and an optional note, exactly once even if the host's notice is repeated.
- **FR-024**: Failed uploads or processing MUST surface a plain explanation to the creator and allow a new file. For a first upload the failure is recorded in the history (back to Draft); for a new version the video stays in Changes requested and the explanation is shown on its status page.

**My videos**

- **FR-030**: My videos MUST list every video of the creator with title, stage, status, latest note from Instik, a views slot and the last-updated date.
- **FR-031**: It MUST offer filters All, In review, Changes requested, Live and Drafts with counts, and the list MUST end (no endless scrolling). Drafts includes videos that are "Ready to submit"; a Changes requested video with a pending new version stays under Changes requested. Deleted drafts are never listed.
- **FR-032**: Rejected videos MUST appear under All with their status and note. Rejection is final: the status page shows the note and history only, with no upload-new-version or edit actions; a creator who wants to try again starts a new video.
- **FR-033**: The views slot MUST show a dash unless the video is live; for live videos it shows a placeholder until statistics exist.
- **FR-034**: Each row MUST open the video's status page.

**Video status page**

- **FR-040**: The page MUST show title, stage, topic, length (when known), the status, a preview of the video, the note from the latest history entry (and no note when that entry has none), and the full history.
- **FR-041**: When status is Changes requested, creators MUST be able to upload a new version and then explicitly submit it again (checklist re-confirmed). The video MUST stay in Changes requested while the new file uploads and processes, held as a pending version and shown as "New version processing" or "New version ready to submit". On submit the pending file becomes the video's file, the previous file MUST be deleted from the video host, and the video MUST go to review as soon as the new file is ready, with the history recording the new submission. A creator may also resubmit after editing details only, when no pending version exists.
- **FR-042**: Creators MUST be able to edit details (title, proposed stage, topic, description) while the video is a Draft or has Changes requested, and not while it is in review or approved.
- **FR-043**: The page MUST include a placeholder for statistics that will appear once the video is live.
- **FR-044**: Creators MUST be able to delete their own Draft videos (including "Ready to submit"), with a confirmation. Deleting is a soft delete: the video is hidden everywhere (the creator's lists, owner lists, learners), its history is kept, and its file is deleted from the video host. Videos in any other status MUST NOT be deletable or withdrawable by the creator.

**Host page**

- **FR-050**: Creators MUST be able to edit their host page: photo, name in Latin letters, name in Arabic, short story and topics.
- **FR-051**: Photos MUST be limited by type (common image formats) and size, and refused with a plain message otherwise.
- **FR-052**: Saved changes MUST appear on the public host page and wherever the host appears, with Arabic shown right-to-left.
- **FR-053**: Creators MUST only be able to edit their own host page.

**Access and privacy**

- **FR-060**: A creator MUST never see or change another creator's videos, history, notes or host page; their addresses behave as missing pages.
- **FR-061**: Videos that are not Approved, and deleted videos, MUST remain invisible to learners at all times.
- **FR-062**: Copy MUST follow the brand voice: short, warm, honest, never shaming.

### Key Entities

- **Video (extended)**: Gains creator-supplied details (title, proposed stage, topic, language, description), a link to the file at the video host, length once known, a flag that the creator has submitted it, and a "deleted" mark for soft-deleted drafts. The final stage and access stay owner-set.
- **Pending new version**: While a video is in Changes requested, at most one new file being uploaded or processed, kept apart from the video's current file until the creator resubmits; it may also hold a plain failure message.
- **Status event**: Existing history entry: from, to, who, when, note.
- **Upload permission**: A single-use, short-lived permission for one browser upload, tied to one creator and one video.
- **Creator profile (host page)**: Photo, Latin name, Arabic name, short story, topics.
- **Checklist agreement**: The creator's confirmation of the pre-submit items at submission time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

SC-001, SC-003 and SC-007 are post-launch checks made with real creators and a real video host; they are not part of the automated test suite.

- **SC-001**: A creator can go from opening Upload a video to a submitted video in under 10 minutes for a typical file, excluding file transfer time.
- **SC-002**: Progress is visible within 2 seconds of choosing a file and updates at least every few seconds until finished.
- **SC-003**: 100% of videos uploaded and submitted appear in In review without further action once processing completes, in a test of at least 20 uploads including ones submitted before processing finished.
- **SC-004**: 100% of status changes appear in the history exactly once, including when host notices are delayed or repeated.
- **SC-005**: In permission tests, no creator can read or change another creator's video, history or host page, and no non-Approved video is ever visible to a learner.
- **SC-006**: A creator can find the latest note on any of their videos within one click from the navigation.
- **SC-007**: A creator who loses connection mid-upload can retry and finish without retyping details, in at least 9 of 10 attempts.
- **SC-008**: Host page edits are visible on the public page within one minute of saving.

## Assumptions

- Spec 8 is in place: roles, creator invites, database content, the status model with history, and empty creator pages behind roles.
- The video host is the one chosen in the product brief; the spec stays host-agnostic. Accounts and credentials for it, and a way to test its notices locally, are prepared by the team beforehand.
- Accepted files are MP4 and MOV, up to 4 GB and 30 minutes (decided limits; the team may change them in one place). The 4 GB limit is checked in the browser only, because the file never reaches our server; the video host's own limit is to be confirmed with Mux.
- Stages and topics use the platform's existing lists. Egyptian Arabic is the only available language at launch.
- The "creator terms" referred to by the checklist are linked as a placeholder page until the team writes them.
- Creator names on the panel come from the host page.
- New versions of Approved videos are out of scope: an Approved video has no way back to the creator in this spec. New versions exist only for videos in Changes requested.
- Paused creators and the rules about them belong to spec 10; this spec relies on whatever spec 8 provides.
- The owner review screens, notes written by owners, emails to creators, statistics, views numbers and earnings are out of scope. Notes and statuses applied by owners are only displayed here.
- Desktop first; the panel remains usable on a phone but is not optimised for uploading from one.
