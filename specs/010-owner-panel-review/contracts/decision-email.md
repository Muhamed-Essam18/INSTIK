# Contract: Decision email

One email per decision, to the creator's account address, sent after the decision is committed.

| Field | Value |
|-------|-------|
| From | The existing `EMAIL_FROM` |
| To | The creator's account email |
| Subject | Approved: `"<title>" is live on Instik`; Changes requested: `Changes needed on "<title>"`; Rejected: `About "<title>"` |
| Body | Hi `<creator name>`, the outcome in one sentence, the owner's note when there is one (labelled "From the Instik team"), a link to My videos, signed "The Instik team". |
| Link | `<site>/creator/videos` (for changes, `<site>/creator/videos/<id>`) |

Rules:

- Short, warm and never shaming; a rejection says the video won't go live and thanks them, with the note.
- Plain text and HTML versions; the title, name and note are HTML-escaped (they come from forms).
- Contains no learner data, no Mux ids and nothing about other creators.
- Recorded in `DecisionEmail` (`SENT` or `FAILED`) keyed by the status history event. A failure stores a short reason, never the provider's body.
- Development: the message is logged instead of failing when the test sender refuses it, as in the invitation email.
