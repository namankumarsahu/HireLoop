# Workflow

```text
                 ┌───────────────────────┐
                 │  Screening call        │
                 │  recording (upload)    │
                 └───────────┬────────────┘
                              │ candidate, role, interviewer + file
                              v
                 ┌───────────────────────┐
                 │  ScreenScribe Express  │
                 │  API                   │
                 └───────────┬────────────┘
                              │ POST /transcribe
                              v
                 ┌───────────────────────┐
                 │   WhipScribe API       │
                 └───────────┬────────────┘
                        poll job status
                              │
                              v
                 ┌───────────────────────┐
                 │ Timestamped transcript │
                 │ + WhipScribe insights  │
                 └───────────┬────────────┘
                              │
                              v
                 ┌───────────────────────┐
                 │  Scorecard extraction  │
                 │  (LLM, JSON schema)    │
                 │  summary / rec /       │
                 │  strengths / concerns  │
                 └───────────┬────────────┘
                              │
                              v
                 ┌───────────────────────┐
                 │  Airtable API          │
                 │  POST .../records      │
                 └───────────┬────────────┘
                              │
                              v
                 ┌───────────────────────┐
                 │ New row in the         │
                 │ Scorecards base,       │
                 │ visible to the whole   │
                 │ hiring team instantly  │
                 └───────────────────────┘
```

## API calls made per submission

1. `POST /transcribe` (WhipScribe) — submit the recording.
2. `GET /jobs/:id` (WhipScribe) — polled every 3s until the job completes.
3. `GET /jobs/:id/result?format=json` (WhipScribe) — fetch the transcript.
4. `GET /jobs/:id/insights` (WhipScribe) — fetch topics/summary if available.
5. `POST /chat/completions` (OpenAI-compatible, optional) — turn the
   transcript into a structured scorecard.
6. `POST https://api.airtable.com/v0/{baseId}/{table}` (Airtable) — create a
   new record in the Scorecards table with the structured fields.

Every one of these is a real network call to the respective API — nothing
here is mocked or hardcoded, which is what makes the 2-minute demo credible.

## Why one row per call, not a search-then-update

Unlike an ATS candidate profile, a plain Airtable base doesn't need a
lookup step — every screening call is its own log entry. That's actually
closer to how teams already use Airtable as a lightweight tracker: one row
per event, filterable/sortable by candidate, role, or recommendation. It
also removes an entire class of "candidate not found" failure that a
search-first integration (like an ATS candidate profile) would have.

## User effort removed

Without ScreenScribe, the recruiter has to:

- replay the call (or rely on memory) to write it up,
- manually structure their notes into strengths/concerns,
- open a tracker and type the note in by hand,
- do all of this again for every call, same day, fading memory each time.

With ScreenScribe, they upload the recording once and a fully structured row
appears in the shared base by the time their next call starts.
