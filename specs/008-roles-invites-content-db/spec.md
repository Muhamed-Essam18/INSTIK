# Feature Specification: Roles, Creator Invites and Content in the Database

**Feature Branch**: `008-roles-invites-content-db`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Spec 8: roles, creator invites and moving content into the database. Three roles (learner, creator by invite only, owner from a configured list of owner emails). Owners invite creators by name and email with a one-time link that expires after 7 days; accepting it makes the account a creator and creates their public host page. Videos, hosts, transcripts and the glossary move from files into the database; languages stay in content/languages.json; a one-time import is safe to run twice and reports anything it could not import. Every video has a status and a full history of status changes. The learner site works as before but shows only Approved videos. Creator and owner areas exist as empty pages behind their roles. Out of scope: uploading, review screens, dashboards, earnings."

## Clarifications

### Session 2026-11-11

- Q: When an existing video cannot be fully imported (e.g. a transcript file that is present but invalid), skip it, save it as a Draft, or stop the import? → A: Save it as a Draft (not visible to learners) and report it as needing attention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The learner site keeps working, now from the database (Priority: P1)

A learner uses Instik exactly as before: library, filters, search, video page with synced transcript, word lookups, host pages and Up next. Behind the scenes, all of this now comes from managed records instead of files, and only Approved videos can ever be seen.

**Why this priority**: It is the foundation for the creator programme and must not regress what learners already have.

**Independent Test**: Run the import, then walk through the library, a video, a host page and search; compare with the pre-change site. Then set one video to a non-Approved status and confirm it disappears everywhere, including its direct address.

**Acceptance Scenarios**:

1. **Given** all sample content is imported as Approved, **When** a learner browses the library, a video, a host page and search, **Then** titles, order, transcripts, glossary lookups, hosts and Up next match what they saw before.
2. **Given** a video is in any status other than Approved, **When** a learner looks for it in the library, search, Up next, its host page or by opening its direct address, **Then** it is not shown and the direct address behaves like a missing page.
3. **Given** a video later returns to Approved, **When** a learner reloads, **Then** it appears again.
4. **Given** the free and full access of each video from before, **When** the learner site runs from the database, **Then** access rules behave as before.

---

### User Story 2 - One-time, repeatable import of existing content (Priority: P1)

An operator runs a single import that moves every existing sample video, host, transcript and glossary entry into the database. Running it again changes nothing that is already imported, and anything that cannot be imported is clearly reported rather than silently dropped.

**Why this priority**: Without it there is no content for the learner site to read.

**Independent Test**: Run the import on an empty database, then run it again, then run it with one deliberately broken source item.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the import runs, **Then** every existing video, host, transcript and glossary entry exists, imported videos are Approved, and a summary lists counts imported.
2. **Given** the import already ran, **When** it runs a second time, **Then** no duplicates are created, nothing already imported is altered, and the summary says everything was already present.
3. **Given** a source item is invalid or incomplete, **When** the import runs, **Then** the other items are still imported, a video that is only partly importable is saved as a Draft (not visible to learners), and the summary names the item and the reason.
4. **Given** a Draft left by an earlier import because its source was incomplete, **When** the source is fixed and the import runs again, **Then** that video is completed and becomes Approved with a history entry, without duplicating anything.
5. **Given** imported videos, **When** their status history is viewed, **Then** each has an initial entry recording that it was imported.

---

### User Story 3 - Owners are recognised and can invite creators (Priority: P2)

Anyone whose account email is on the configured owner list is an Owner. An owner invites a creator by entering name and email. The invitee receives a one-time link, valid for 7 days. Opening it, signing in and accepting makes that account a creator and creates their creator profile.

**Why this priority**: Creators are the purpose of the programme, but nothing else depends on this until uploading exists.

**Independent Test**: As an owner, invite a new email; open the link, accept, and confirm the account is a creator with a public host page. Reuse the link and use an expired link and confirm both are refused.

**Acceptance Scenarios**:

1. **Given** an account whose email is on the owner list, **When** it signs in, **Then** it has the owner role; removing the email from the list removes the role at the next permission check.
2. **Given** an owner enters a name and email, **When** they send the invite, **Then** an invitation is recorded as pending, an email with a one-time link is sent, and the link expires 7 days after it was created.
3. **Given** a valid pending invite, **When** the invitee opens the link, signs in and accepts, **Then** the account becomes a creator, a creator profile is created from the invited name, and the invite is marked used.
4. **Given** an invite that was already used, expired, or revoked, **When** its link is opened, **Then** it is refused with a calm message and nothing changes.
5. **Given** an owner re-invites the same email, **When** a new invite is sent, **Then** any earlier pending invite for that email stops working.
6. **Given** a creator profile exists, **When** anyone opens its host page, **Then** it appears as a host page like the existing hosts, listing only that host's Approved videos.

---

### User Story 4 - Role-protected creator and owner areas (Priority: P2)

Creator and owner areas exist as empty placeholder pages. A learner opening either is turned away; a creator can open only the creator area; an owner can open the owner area. A creator never sees another creator's data.

**Why this priority**: It establishes the permission boundary every later creator feature builds on.

**Independent Test**: Visit each area signed out, as a learner, as a creator and as an owner, and confirm what is shown.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open a creator or owner area, **Then** they are asked to sign in.
2. **Given** a learner, **When** they open a creator or owner area, **Then** they are turned away without revealing what is there.
3. **Given** a creator, **When** they open the owner area, **Then** they are turned away; **When** they open the creator area, **Then** it shows an empty page addressed to them.
4. **Given** two creators, **When** either asks for data (videos, status history, profile) belonging to the other, **Then** nothing of the other's is returned.
5. **Given** an owner, **When** they open the owner area, **Then** it shows an empty page.

---

### User Story 5 - Every video has a status and a full history (Priority: P3)

Each video has one of seven statuses: Draft, Uploading, Processing, In review, Changes requested, Rejected, Approved. Every change of status is recorded with who changed it, when, and the note.

**Why this priority**: Later specs (upload, review) rely on it, but only Approved matters to learners today.

**Independent Test**: Change a video's status through the allowed path and verify the history lists each change in order with who, when and note.

**Acceptance Scenarios**:

1. **Given** a video, **When** its status changes, **Then** a history entry records previous status, new status, who made the change, the time and the note.
2. **Given** a change to Rejected or Changes requested, **When** no note is supplied, **Then** the change is refused.
3. **Given** a change not on the allowed path (for example Draft straight to Approved), **When** it is attempted, **Then** it is refused and history is unchanged.
4. **Given** a history entry, **When** anyone tries to edit or delete it, **Then** this is not possible.
5. **Given** a video in review, **When** a creator (even its own creator) tries to approve, reject or request changes, **Then** it is refused; **When** an owner does, **Then** it is recorded. **Given** another creator's video, **When** a creator tries any change, **Then** it is refused as if the video did not exist.

### Edge Cases

- An owner invites an email that already belongs to a learner account: accepting turns that account into a creator, keeping its learner data.
- The invite is opened while signed in with a different email than invited: the invite stays bound to the invited email and is refused with a clear message.
- The invite is opened by someone who already is a creator or owner: refused without changing anything.
- An owner's email is removed from the list while they are signed in: owner access is withdrawn at the next permission check.
- Two people open the same invite link at nearly the same time: only one acceptance succeeds.
- A video has no host or an unknown language during import: that item is reported as failed; others continue.
- A video with no transcript file at all (six of the eight sample videos today) is imported as Approved with no transcript, exactly as it behaves now. A transcript file that exists but is unreadable, empty or invalid makes the video a Draft, not visible to learners, and the item is reported as needing attention.
- A language has no Approved videos: the learner sees an empty state with a visible end of the list, as today.

## Requirements *(mandatory)*

### Functional Requirements

**Roles**
- **FR-001**: Every account MUST be exactly one of learner, creator or owner; new accounts are learners.
- **FR-002**: An account MUST be an owner if and only if its email is on the configured owner list; the list is the only way to become an owner.
- **FR-003**: Becoming a creator MUST be possible only by accepting an owner's invitation; there is no public creator sign-up.
- **FR-004**: Every permission MUST be checked on the server on every read and write; hiding links or buttons is never the control.

**Invitations**
- **FR-005**: Owners MUST be able to invite a creator by name and email.
- **FR-006**: Each invitation MUST carry a one-time link that expires 7 days after creation and can be used once.
- **FR-007**: The invitation email MUST contain only the link, the Instik team name and the invited name.
- **FR-008**: Accepting a valid invitation MUST turn the account into a creator and create their creator profile in one step; if either part fails, neither takes effect.
- **FR-009**: Used, expired, revoked and superseded invitations MUST be refused with a calm message and without changing any data.
- **FR-010**: Owners MUST be able to see the state of invitations they sent (pending, used, expired, revoked) and revoke a pending one.
- **FR-011**: A creator profile MUST serve as the creator's public host page, with name in Latin and Arabic where provided, a short story and topics. The page MUST open for any existing host even when it has no Approved videos (it then shows an empty list that still ends), and a host with an empty story MUST show a calm placeholder to visitors instead of blank space. Imported hosts keep their full details.
- **FR-031**: Inviting an email that already belongs to an owner or a creator MUST be refused with a clear message, and no invitation is created.

**Content in the database**
- **FR-012**: Videos, hosts, transcripts (time-coded segments with Arabic text with tashkeel, transliteration and English), glossary entries and word links MUST be stored as managed records, not read from files at runtime.
- **FR-013**: Languages MUST remain in `content/languages.json`; every video, host and glossary entry belongs to one of those languages.
- **FR-014**: A one-time import MUST bring in all existing sample videos, hosts, transcripts and glossary entries.
- **FR-015**: The import MUST be safe to run repeatedly: no duplicates, and nothing already imported is changed.
- **FR-016**: The import MUST finish with a report of items imported, already present and failed, naming each failed or incomplete item and its reason, and MUST NOT stop at the first failure. A video whose source is incomplete MUST be saved as a Draft rather than dropped or published; a later run MUST complete it once the source is fixed.
- **FR-017**: Imported videos MUST keep their existing titles, addresses, stage, topic, access (free or full), duration and host.

**Status and history**
- **FR-018**: Every video MUST have exactly one of: Draft, Uploading, Processing, In review, Changes requested, Rejected, Approved.
- **FR-019**: Allowed changes MUST follow: Draft → Uploading → Processing → In review; Processing → Draft (when processing fails; the system adds the note "The upload didn't work. Please try again.", and the creator starts the upload again from Draft); In review → Approved, Changes requested or Rejected; Changes requested → Uploading (a new version) or In review. Any other change MUST be refused. The import is the only exception: it may place a video directly in Approved (recorded as an import entry), and it does so through its own path, never through the status change rules.
- **FR-020**: Every status change MUST be recorded with the previous and new status, who made it, when, and a note; a note MUST be required for Rejected and Changes requested.
- **FR-021**: Status history MUST be append-only; entries cannot be edited or deleted.
- **FR-030**: Who may make each status change MUST be enforced on the server: the **system** (video host notifications) moves Uploading → Processing and records processing results (Processing → In review when the video is ready, Processing → Draft when processing failed, with the automatic note "The upload didn't work. Please try again."); a **creator**, only on their own videos, may save drafts (no status change), submit for review by starting the upload from Draft (Draft → Uploading), and upload a new version or resubmit after changes were requested (Changes requested → Uploading or In review); **only owners** may move a video from In review to Approved, Changes requested or Rejected. Nobody else may change a status, and the import is the only exception (FR-019).

**Learner site**
- **FR-022**: The learner site MUST read all content from the database and look and behave as before.
- **FR-023**: Learners MUST only ever see Approved videos: in library, filters, search, Up next, host pages, "pick up where you left off", progress views and direct addresses.
- **FR-024**: Videos that are not Approved MUST be unavailable even to a learner who knows the address, and their status MUST NOT be revealed.
- **FR-025**: Hours, rhythm, saved position and other learner data tied to a video MUST be preserved for imported videos.

**Protected areas**
- **FR-026**: A creator area and an owner area MUST exist as empty pages, reachable only by their roles: the creator area for creators, the owner area for owners.
- **FR-027**: Signed-out visitors MUST be asked to sign in; learners (and creators, for the owner area) MUST be turned away.
- **FR-028**: A creator MUST NEVER be able to read or change another creator's profile, videos, status history or invitations; owners can access all.
- **FR-029**: Role and ownership rules MUST be covered by automated tests that include a creator trying to reach another creator's data.

### Key Entities

- **Account role**: learner, creator or owner; owner derived from the owner email list, creator from an accepted invitation.
- **Creator invitation**: invited name and email, who sent it, created time, expiry time (7 days), state (pending, used, expired, revoked), used time and the account that used it.
- **Creator profile**: one per creator; public host-page details; links to the creator's videos.
- **Host**: the person shown with a video; existing hosts become host profiles, and a creator profile is a host.
- **Video**: title, address, language, stage, topic, host, duration, access (free or full), status, and links to transcript and glossary words. Video file details are not part of this spec.
- **Transcript segment**: time range with Arabic text, transliteration and English for a video.
- **Glossary entry**: a per-language word with meaning, transliteration and audio, linked from transcript words.
- **Status history entry**: video, previous status, new status, who, when, note.
- **Import report**: counts of imported, already present and failed items with reasons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After import, 100% of existing sample videos, hosts, transcripts and glossary entries are present, and the learner site shows the same library, transcripts and host pages as before the change.
- **SC-002**: Running the import twice in a row produces zero new or changed records on the second run.
- **SC-003**: A deliberately broken source item is reported by name and reason, kept as a non-visible Draft if it is a video, and all other items are still imported (0 silent drops, 0 broken videos visible to learners).
- **SC-004**: 0 non-Approved videos are visible to a learner on any page, list, search or direct address in a test that covers every learner-facing path.
- **SC-005**: An invitation link works exactly once, within 7 days; 100% of reused, expired or revoked links are refused without changing any account.
- **SC-006**: In role tests, 100% of attempts by learners to open creator or owner areas, and by creators to open the owner area or another creator's data, are refused.
- **SC-007**: Every status change in tests produces a history entry with who, when and note, and 100% of changes outside the allowed path are refused.
- **SC-008**: Existing learner journeys (library to video to Done for today) complete with no regressions in the existing test suite.
- **SC-009**: The library and watch pages render as fast as they do today on the sample content set.
- **SC-010**: In tests, every imported video and host keeps the address (slug) of its source file, and saved progress, hours and rhythm for those videos still resolve to them.

## Assumptions

- Owners sign in the same way as everyone else (Google or email link); the owner list is configured outside the product and changes need no screen.
- The email sending already used for sign-in can also deliver invitations.
- A creator profile is created in the default available language for now; per-language creator profiles come later with the upload spec.
- Processing results come from the video host in a later spec; this spec defines only the rule for who may record them (FR-030).
- Imported sample content is treated as Approved, since it is already live today.
- Hosts that exist today become host profiles without a login; they are not creators.
- Pausing creators, per-creator stats, uploading, review, transcript editing, dashboards and earnings are out of scope and arrive in later specs.
- The invite link needs only sign-in and one accept step, no further confirmation.
- No change to `docs/product.md` is needed; this spec follows its Content model and Roles sections and the constitution v2.0.0 (principles VIII and XI).
