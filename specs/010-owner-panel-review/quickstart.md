# Quickstart: validating the owner panel

## Prerequisites

- Specs 8 and 9 working locally; `npm install`; a development database with the migrations applied (`npm run db:migrate`).
- `OWNER_EMAILS` set to your email; at least one creator account with a complete host page.
- Mux and Resend settings as in `.env.example` (the email is logged in development if Resend refuses the test sender).
- A small `.vtt` file with a few cues in Arabic.

## Automated checks

```text
npm run lint
npm run typecheck
npm test
npm run build
```

The new tests live in `tests/unit/review/` and `tests/unit/creators/`. Key ones: approve guard (every missing piece refused), notes
required, two simultaneous decisions, segment validation and overlap, vtt mapping, glossary matching and refusal of duplicates, decision
email (one per decision, failure recorded, decision stands), pause blocks every creator write, pause leaves live videos, and a creator
attempting every owner action.

## Manual walkthrough

1. As a creator, upload and submit a video (spec 9). Sign out.
2. As an owner open `/owner`: the counts show one Needs review; the video is listed with its days waiting. Follow the Waiting on creator count to `/owner/waiting` (read-only list).
3. Open it: play it, set stage (pre-filled from the proposal) and access. Tick four checklist items; Approve stays disabled and says why.
4. Import the `.vtt` (check the summary, choose Add). Edit a segment's transliteration and English; watch "Saved" appear. Reload: all there.
5. Tap an unlinked word, add it to the glossary, and see it marked as linked.
6. Tick the fifth item: Approve unlocks. Approve with no note: the video is live in `/learn/arabic-egyptian` at once, with its transcript.
7. Check the creator's inbox (or the dev log) for one email, and My videos for the status and note.
8. Repeat with another submitted video: Request changes with an empty note (refused), then with a note; the creator sees the note and can upload a new version. Resubmit: the checklist is cleared and the transcript kept. Reject a third video with a note.
9. `/owner/creators`: invite a new email, resend it (the first link stops working), accept it in another browser.
10. Pause that creator: they cannot start an upload, submit or edit their host page, their Approved videos still play, and the owner's queue still shows their videos in review. Resume: uploads work again.
11. Open a creator's stats and check the counts against My videos.
12. As a plain learner and as a creator, try `/owner`, `/owner/review/<id>` and `/owner/creators`: not found.

## Done when

All automated checks pass and the walkthrough matches the expected result at every step.
