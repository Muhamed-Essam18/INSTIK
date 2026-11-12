# Quickstart: Validating Roles, Invites and Content in the Database

Prerequisites: `.env.local` with the usual settings; `OWNER_EMAILS` set to your own sign-in email; a development database
(a Neon branch is fine). See [contracts/routes-and-actions.md](contracts/routes-and-actions.md) and
[data-model.md](data-model.md) for details.

## 1. Automated checks

```text
npm run typecheck
npm run lint
npm test
npm run build        # must pass with no database or secrets
```

Expected: all pass. New tests cover the status machine, role resolution, invite rules and service, import planning and
running, Approved-only reads, and creator scoping with two creators.

## 2. Apply the schema and import

```text
npm run db:migrate
npm run import:content -- --dry-run
npm run import:content
npm run import:content
```

Expected: the dry run writes nothing; the first import reports 2 hosts, 8 videos, 2 transcripts and the glossary imported;
the second import reports everything already present and zero imported. Exit code 0 both times.

## 3. Broken source item

Temporarily damage `content/arabic-egyptian/videos/my-family.vtt` (for example remove the `WEBVTT` line), then run the
import on a fresh database.

Expected: 7 videos Approved, `my-family` saved as Draft and listed under `incomplete` with the reason, exit code 1.
Restore the file and run again: `my-family` is completed and Approved, no duplicates, exit code 0.

## 4. Learner site is unchanged and Approved-only

1. `npm run dev`, sign in as a learner, open the library, a video, a host page and search.
2. Expected: the same eight videos, hosts, transcripts and word cards as before.
3. In the database set one video's status to `IN_REVIEW` (or use the status service in a test). Reload.
4. Expected: it is gone from the library, search, Up next and its host page, and its direct address shows the not-found
   page. Set it back to `APPROVED`: it returns.

## 5. Roles and areas

| As | Open | Expected |
|---|---|---|
| Signed out | `/creator`, `/owner` | Redirect to sign-in, then back after signing in (and the role check applies). |
| Learner | `/creator`, `/owner` | Not-found page, with no hint that the area exists. |
| Creator | `/owner` | Not-found page. `/creator` shows an empty page addressed to them. |
| Owner (email in `OWNER_EMAILS`) | `/owner`, `/owner/creators` | Empty owner page and the invite form. `/creator` is not-found. |

## 6. Invitations

1. As owner, invite a second email you control at `/owner/creators`. Expected: the invitation appears as pending; the
   email has the link, the invited name and the 7-day note.
2. Open the link signed out: redirected to sign in; after signing in with the invited address, the accept page shows.
3. Accept. Expected: redirected to `/creator`; the account is a creator; its host page exists at
   `/learn/arabic-egyptian/hosts/<slug>` with no videos yet.
4. Open the same link again: the calm "can't be used" message. The invitation list shows it as used.
5. Create another invite, sign in with a different email and open it: the "different email address" message; nothing changes.
6. Revoke a pending invite, or send a second invite to the same email, and open the earlier link: refused.
7. Set `expiresAt` to the past in the database for a pending invite: refused as well.

## 7. Status history

In a test or script call `changeStatus` through the allowed path and check the events: previous and new status, actor,
time and note, in order. A move straight from Draft to Approved is refused; Rejected or Changes requested without a note is
refused; an `UPDATE` or `DELETE` on a status event fails at the database.
Also check in the account menu (the round button in the header): a learner sees Settings and Sign out; a creator sees
Creator panel first; an owner sees Owner panel first. The role is read again on every request.

## 8. Production launch checklist (deferred T051)

The full walkthrough on a fresh database is not run in development. It belongs to the production launch: apply the
migration to the **production** database (`prisma migrate deploy`), run `npm run import:content` there, set
`OWNER_EMAILS`, then repeat steps 2 to 7 once and tick each expected outcome. The development database already passed
steps 2, 4 (learner site), 6 and 7 on 2026-11-12/13.
Reminder for launch: invite links are only printed to the server log in development; in production they go by email only,
so the sending domain must be verified in Resend first (the test sender reaches one address only).
