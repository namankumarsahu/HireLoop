# Problem — ScreenScribe

## Who

A recruiter or hiring manager who runs first-round screening calls (phone or
video) and tracks candidates somewhere the whole hiring team can see —
whether that's a full ATS or, very commonly at smaller companies, a shared
Airtable base.

## Current workflow

1. Recruiter has a 20–30 minute screening call with a candidate.
2. Immediately after (or, realistically, hours later between other calls),
   they're supposed to write up a scorecard: strengths, concerns, whether the
   candidate should move forward.
3. That scorecard has to be logged in the ATS so the rest of the hiring team
   can see it before the next round or the debrief.
4. In practice, step 3 gets delayed, shortened, or skipped entirely once a
   recruiter has done four calls in a day. Notes get vaguer with each call as
   memory fades.

## Cost

The interview itself already contains everything needed for a good
scorecard — what was asked, what was answered, how confident the candidate
sounded, what wasn't covered. The cost isn't running the call; it's the
manual translation of that call into a structured, ATS-native note, done
under time pressure, from memory.

Bad or missing scorecards cause real damage: hiring committees make decisions
on thin information, good candidates get a lukewarm note because the
recruiter forgot a strong answer, and the next interviewer in the loop
repeats questions that were already answered.

## Why recordings are the way in

A screening call already has a clear structure (intro, background, technical
or behavioral questions, candidate questions, wrap-up). A transcript
preserves exactly what was said and by whom, which is what a scorecard should
be based on — not a recruiter's memory 3 hours later.

## Proposed workflow

**Call recording → WhipScribe transcript → structured scorecard → Airtable
row**

The recruiter should not have to write the scorecard from scratch. They
should review and adjust a draft that's already sitting on the candidate's
profile by the time their next call starts.

## MVP success condition

Given one real (or realistic mock) screening call recording, ScreenScribe
can:

- produce a transcript via the WhipScribe API,
- extract a structured scorecard (summary, recommendation, strengths,
  concerns, topics covered, suggested follow-ups, red flags),
- write that scorecard as a new row in a shared Airtable base via Airtable's
  public API,
- do all of this with a single file upload and no manual copy-pasting.

## What this is not

It's not a general-purpose meeting notetaker and not a replacement for the
recruiter's judgment — the note is a first draft that speeds up and
standardizes what already has to be written, not an automated hiring
decision. It's scoped tightly to the one step that's expensive and
inconsistent today: turning a screening call into an ATS-ready note.
