# Data Model: Roles, Creator Invites and Content in the Database

Prisma names; `languageCode` values are the `code` field of `content/languages.json` entries (for example `arz`), and
`languageSlug` is the URL form. Existing learner tables are listed only to show what stays unchanged.

## Changes to existing models

### User
| Field | Type | Notes |
|---|---|---|
| `role` | `Role` enum (`LEARNER`, `CREATOR`), default `LEARNER` | Owner is never stored; it is derived from `OWNER_EMAILS`. |
| `host` | `Host?` | Back-relation: the creator's profile, if any. |
| `statusEvents` | `VideoStatusEvent[]` | Events this user made. |
| `invitesSent` | `CreatorInvite[]` | Invitations this owner sent. |

Unchanged and keyed by text: `VideoProgress`, `WatchSession`, `ComprehensionAnswer` (`languageCode` + `videoSlug`).

## New enums

- `Role`: `LEARNER`, `CREATOR`
- `VideoStatus`: `DRAFT`, `UPLOADING`, `PROCESSING`, `IN_REVIEW`, `CHANGES_REQUESTED`, `REJECTED`, `APPROVED`
- `VideoAccess`: `FREE`, `FULL`

## New models

### Host (the "creator profile" and the existing hosts)
| Field | Type | Rules |
|---|---|---|
| `id` | cuid | |
| `languageCode` | text | One of the languages in `languages.json`. |
| `slug` | text | `^[a-z0-9]+(-[a-z0-9]+)*$`; unique with `languageCode`. |
| `name` | text | Latin name, non-empty. |
| `nameArabic` | text? | Required for imported hosts; optional for new creators until they fill it in. |
| `story` | text | Short story. Imported hosts always have one (`hostSchema` stays strict). A new creator starts with an empty story and visitors see a calm placeholder instead of blank space. |
| `topics` | text[] | 0–6 entries. Imported hosts have 1–6. |
| `photo` | text? | Path or URL, null allowed. |
| `order` | int | Display order of hosts; creators get the next number. |
| `userId` | text? unique | Set for a creator profile (links to `User`); null for imported hosts. |
| `sample` | boolean | True for imported sample hosts. |
| `createdAt` | timestamp | |

Unique: `(languageCode, slug)`. A creator's slug is derived from the invited name (`omar-2` style suffix on clash).
Host pages list only that host's Approved videos.

### Video
| Field | Type | Rules |
|---|---|---|
| `id` | cuid | |
| `languageCode` | text | |
| `slug` | text | Same slug rule; unique with `languageCode`. This pair is what learner tables store. |
| `title` / `titleArabic` | text / text? | Non-empty title. |
| `stage` | text | A slug from `taxonomy.ts` (`hear-it`, `follow-it`, `understand-it`, `join-in`). |
| `topic` | text | A slug from `taxonomy.ts`. |
| `hostId` | text | Required; `Host`. |
| `durationSeconds` | int | ≥ 1. |
| `access` | `VideoAccess` | `FREE` or `FULL`; set by the owner. |
| `playbackId` | text? | Video host playback id; null until a video exists. No file details live here. |
| `status` | `VideoStatus` | Default `DRAFT`. Changed only through the status service. |
| `sample` | boolean | |
| `createdAt` / `updatedAt` | timestamp | |

Unique: `(languageCode, slug)`. Index: `(languageCode, status)`.

### TranscriptSegment
| Field | Type | Rules |
|---|---|---|
| `id` | cuid | |
| `videoId` | text | `Video`, cascade delete with the video. |
| `position` | int | Order, unique with `videoId`. |
| `start` / `end` | float | Seconds; `end > start`; ordered and non-overlapping per video (checked by the importer through the existing transcript rules). |
| `script` | text | Arabic with tashkeel as stored; non-empty. |
| `transliteration` / `english` | text? | Null when the layer has nothing for that line. |

### GlossaryEntry
| Field | Type | Rules |
|---|---|---|
| `id` | cuid | |
| `languageCode` | text | |
| `entryKey` | text | The entry `id` from the file (for example `ana`); unique with `languageCode`. |
| `word` | text | With tashkeel. |
| `base` | text | Normalised form used for matching. |
| `transliteration` / `english` | text | Non-empty. |
| `audio` | text? | |

Ambiguity rule kept: two entries with the same normalised `base` in one language that would link the same word are still
rejected by the existing glossary-link builder; the importer runs it and reports a failure.

### VideoStatusEvent (append-only)
| Field | Type | Rules |
|---|---|---|
| `id` | cuid | |
| `videoId` | text | `Video`, cascade delete with the video. |
| `fromStatus` | `VideoStatus?` | Null for the first event of a video. |
| `toStatus` | `VideoStatus` | |
| `actorId` | text? | `User`, `SetNull` on delete. |
| `actorLabel` | text | Who, readable later (`import`, or the person's name). Never empty. |
| `note` | text? | Required (non-blank) when `toStatus` is `REJECTED` or `CHANGES_REQUESTED`; max 2,000 chars. |
| `createdAt` | timestamp | Server time. |

A database trigger raises an error on `UPDATE` and on `DELETE` of this table. Cascade deletion of a whole video is the one
way rows disappear, and no code path deletes videos in this spec.

### CreatorInvite
| Field | Type | Rules |
|---|---|---|
| `id` | cuid | |
| `name` | text | Invited name, 1–120 chars. |
| `email` | text | Trimmed, lower-cased, valid. |
| `tokenHash` | text unique | SHA-256 of the link token; the token itself is never stored. |
| `invitedById` | text | `User` (the owner). |
| `createdAt` | timestamp | |
| `expiresAt` | timestamp | `createdAt + 7 days`. |
| `usedAt` | timestamp? | Set once, at acceptance. |
| `usedById` | text? | `User` that accepted. |
| `revokedAt` | timestamp? | Set when revoked or superseded by a newer invite for the same email. |

Derived state: `used` if `usedAt`, else `revoked` if `revokedAt`, else `expired` if `expiresAt <= now`, else `pending`.
Index: `(email)`.

## State transitions: Video status

Who may make each move (FR-030): system `Uploading→Processing`, `Processing→In review`, `Processing→Draft` (failure, with
the automatic note "The upload didn't work. Please try again."); creator, own videos only, `Draft→Uploading`,
`Changes requested→Uploading`, `Changes requested→In review`; owner `In review→Approved|Changes requested|Rejected`.

```text
Draft ──► Uploading ──► Processing ──► In review ──► Approved           (terminal here)
  ▲                         │               │ ├────► Rejected           (terminal here, note required)
  └───────── (failed) ──────┘               │ └────► Changes requested  (note required)
Changes requested ──► Uploading (a new version) or In review (resubmit)
```

Exception, import only: create directly as `APPROVED`, and move an import-made incomplete `DRAFT` to `APPROVED`.

## Role resolution

`resolveRole(user, ownerEmails)` returns `owner` if the lower-cased email is in the list, else `creator` if `user.role` is
`CREATOR`, else `learner`.

## Scoping rules (what each role may read)

| Reader | Videos | Hosts | Status events | Invites |
|---|---|---|---|---|
| Learner site / anonymous | Approved only | Hosts with at least one Approved video, plus all imported hosts, showing Approved videos only | none | none |
| Creator | Own videos, any status | Own profile | Own videos only | none |
| Owner | All | All | All | All |
