# Contract: Routes, Server Actions and Data Access

Everything here is checked on the server in the Data Access Layer (`src/lib/session.ts` and the modules it guards).
Hiding a link is never the control.

## Pages

| Path | Who may open it | Otherwise |
|---|---|---|
| `/creator` | Creator | Signed out: redirect to `/sign-in?returnTo=/creator`. Any other role: not-found page. |
| `/owner` | Owner | Signed out: redirect to sign-in with `returnTo`. Any other role (learner, creator): not-found page. |
| `/owner/creators` | Owner | Same as `/owner`. Shows the invite form and the list of invitations with state. |
| `/invite/[token]` | Anyone with a link | See below. |
| `/learn/[language]/...` | As today | Reads are Approved-only. |

The proxy adds an optimistic session-cookie check for `/creator` and `/owner` (and `/owner/*`). It decides nothing else.

### `/invite/[token]`

| Situation | Result |
|---|---|
| Token unknown, used, expired, revoked or superseded | One calm message: "This invitation can't be used. Ask the Instik team for a new one." No detail about which. No data changes. |
| Valid, signed out | Redirect to sign-in with `returnTo=/invite/<token>`. |
| Valid, signed in, email differs from invited email | Message: "This invitation was sent to a different email address. Sign in with the address it was sent to." No data changes. |
| Valid, signed in, account is already creator or owner | Message that nothing needs doing, with a link to the creator or owner area. No data changes. |
| Valid, signed in, email matches | Page with the invited name and one "Accept" button. Accepting runs `acceptInvite`. |

## Server actions

All validate input with zod and re-check the role inside the action.

### `createInvite(formData)` — owner only
- Input: `name` (trimmed, 1–120), `email` (trimmed, lower-cased, valid, max 254).
- Refuses with a field-level message when the email already belongs to an owner or a creator (FR-031); no invitation is created.
- In one transaction: revoke earlier pending invites for the email, create the new invite (7-day expiry), then send the
  email. If sending fails, the new invite is revoked and the owner sees "Couldn't send the email. Try again."
- Output: `{ ok: true }` or `{ ok: false, field?: "name" | "email", message }`. Never returns the token.
- Rate limit: reuse the existing throttle keyed by owner id (at most 20 invitations per hour).

### `revokeInvite(inviteId)` — owner only
- Sets `revokedAt` on a pending invite. Revoking a used, expired or already revoked invite is a no-op with a message.

### `acceptInvite(token)` — signed-in account
- One transaction, in this order: claim the invite with a conditional update (not used, not revoked, not expired, email
  equals the account email); set `User.role = CREATOR`; create the `Host` profile (`userId` = the account, name from the
  invitation, generated slug, in the default available language for now; per-language profiles come with the upload spec); mark the invite used with `usedById`.
- Any failure rolls back all of it. Exactly one of two simultaneous calls succeeds.
- Output: `{ ok: true }` then redirect to `/creator`, or `{ ok: false, reason }` with the same calm messages as the page.

## Data Access Layer functions

Added to `src/lib/session.ts`:

```text
getActor(): Promise<Actor | null>                  // { id, email, name, role: "learner" | "creator" | "owner" }
requireRole(role, returnTo): Promise<Actor>        // signed out -> redirect; wrong role -> notFound()
requireOwner(returnTo), requireCreator(returnTo)   // wrappers
```

Learner-facing content reads (`src/lib/content/index.ts`), all async and Approved-only, none accepting a status:

```text
getVideos(language), getVideo(language, slug), getHosts(language), getHost(language, slug),
getVideosByHost(language, hostSlug), getTranscriptView(language, videoSlug), getGlossary(language)
```

`getHost(language, slug)` returns any host with that slug, whatever the status of its videos (a new creator's page opens with
an empty list); only `getHosts(language)`, the list, is filtered to imported hosts and hosts with at least one Approved video.
`getVideosByHost` is always Approved-only.

Creator and owner reads (`src/lib/content/creator-reads.ts`), each takes the acting user and scopes by it:

```text
listOwnVideos(actor), getOwnVideo(actor, videoId), listStatusHistory(actor, videoId)   // creator: own only; owner: all
listAllVideos(actor)                                                                   // owner only
listInvites(actor)                                                                     // owner only
```

A creator or learner calling an owner-only function gets an error and no data. Functions never take a bare user id to
read "someone else's" data.

Status change (`src/lib/content/status-service.ts`):

```text
changeStatus({ videoId, to, actor, note? }): Promise<{ ok: true } | { ok: false, reason: "not-allowed" | "note-required" | "not-found" | "forbidden" }>
// actor: an Actor (creator or owner) or { kind: "system", label } for the video host's webhook (later spec)
```

Moves and who may make them follow FR-030 and [data-model.md](../data-model.md): system `Uploading→Processing`,
`Processing→In review`, `Processing→Draft` (failure; automatic note); creator, own videos only, `Draft→Uploading`,
`Changes requested→Uploading|In review`; owner `In review→Approved|Changes requested|Rejected`. A video the actor may not
see is `not-found`; a move the actor may not make is `forbidden`. The event and the new status are written in one
transaction. The import never calls this function. In this spec only the import and tests call it; later specs add the callers (upload, review).

## Environment

| Name | Required | Meaning |
|---|---|---|
| `OWNER_EMAILS` | No | Comma-separated owner emails; trimmed, lower-cased; invalid entries ignored. Empty or unset means no owners. |

Documented in `.env.example`.

## Email

Invitation email to the invited address: subject "You're invited to create on Instik"; body has the invited name, the
Instik team, the link and the sentence that it works once and expires in 7 days. No other personal data.
