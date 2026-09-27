# Two-minute demo script

## 0:00–0:15 — Problem

"Recruiters run 4–5 screening calls a day and are supposed to write a
structured scorecard afterward — into whatever tracker their team uses. In
practice that gets rushed, delayed, or skipped, and the hiring team ends up
deciding on thin notes."

## 0:15–0:35 — Upload

Fill in candidate name, role, interviewer, and upload a short screening-call
recording (a 2–3 minute mock call works fine for the demo).

Say: "This goes straight to WhipScribe for transcription — nothing here is
pre-recorded or faked, watch the status update live."

## 0:35–1:00 — Transcription → scorecard

Show the status ticking through: transcribing → generating scorecard →
writing to Airtable.

Say: "Once the transcript is back, we turn it into a structured hiring
scorecard — recommendation, strengths, concerns, topics actually covered on
the call, and suggested follow-up questions for the next interviewer."

## 1:00–1:30 — Airtable

Click "open in Airtable" and switch to that tab, already open.

Show the new row appear in the Scorecards base, written via a real
`POST .../v0/{baseId}/{table}` API call — not copy-pasted.

Say: "By the time the recruiter's next call ends, this row is already
sitting in the shared base the whole hiring team looks at."

## 1:30–1:50 — Why this matters

"This isn't a demo of transcription. WhipScribe is the essential first step,
but the actual value is closing the loop from a live conversation to a
structured record in the tool the team already checks — the same job
Metaview and BrightHire get paid to do for ATS-native teams, built
end-to-end here in a weekend for teams that just use a shared tracker."

## 1:50–2:00 — Vision

"Today this handles one call. The natural next step is aggregating every
interviewer's scorecard for a candidate into one row-linked hiring-committee
view, automatically, before the debrief — and pushing the same structured
data into an ATS like Ashby or Greenhouse for teams that have one."
