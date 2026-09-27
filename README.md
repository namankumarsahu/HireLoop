# ScreenScribe

Track 4 submission for the WhipScribe Buildathon.

## Problem

A recruiter runs a screening call, and then has to manually write a
structured scorecard afterward — from memory, under time pressure, often
delayed or skipped. ScreenScribe closes that loop automatically:

**Call recording → WhipScribe transcript → structured scorecard → Airtable row**

The first user is a recruiter or hiring manager who already runs screening
calls and tracks candidates in a shared Airtable base (very common at
smaller companies and agencies that don't run a full ATS).

## What the MVP does

1. Recruiter uploads a screening call recording with the candidate's name,
   role, and interviewer.
2. The recording is sent to the WhipScribe API for transcription.
3. The backend polls until the transcript is ready, then fetches the
   transcript and WhipScribe insights.
4. An LLM turns the transcript into a structured scorecard: summary,
   recommendation, strengths, concerns, topics covered, suggested follow-up
   questions, and any red flags — strictly grounded in what was actually
   said.
5. The backend writes the scorecard as a new row in an Airtable base via the
   Airtable REST API.
6. The recruiter sees the scorecard and a direct link to the Airtable base.

The WhipScribe API is the essential first step — nothing downstream works
without a real transcript. See the official API docs for the current
endpoint contract.

## Architecture

```text
Browser (React)
  |
  | POST /api/calls  (multipart: recording + candidate/role fields)
  v
Express API
  |
  | multipart upload
  v
WhipScribe API
  |  POST /api/v1/transcribe
  |  GET  /api/v1/jobs/:id
  |  GET  /api/v1/jobs/:id/result?format=json
  |  GET  /api/v1/jobs/:id/insights
  v
Scorecard builder (LLM, JSON schema)
  |
  v
Airtable API
  |  POST https://api.airtable.com/v0/{baseId}/{table}
  v
New row in the Scorecards base
```

See `docs/workflow.md` for the full diagram and the exact list of API calls
made per submission.

## Run locally

### Requirements

- Node.js 20+
- A WhipScribe API key with available API credit
- A free Airtable account, with:
  - a base containing a table (default name `Scorecards`) with these fields:
    `Candidate Name` (single line text), `Candidate Email` (email),
    `Role` (single line text), `Interviewer` (single line text),
    `Recommendation` (single line text or single select: Strong Yes / Yes /
    No / Strong No), `Summary` (long text), `Strengths` (long text),
    `Concerns` (long text), `Topics Covered` (long text),
    `Follow-up Questions` (long text), `Red Flags` (long text),
    `Call Date` (date), `Source` (single line text)
  - a Personal Access Token from airtable.com/create/tokens with
    `data.records:read` + `data.records:write` scopes and access granted to
    that base
- Optional: an OpenAI-compatible API key for LLM scorecard generation (works
  without one, using a deterministic fallback, but the scorecard is much
  richer with an LLM)

### 1. Start the backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```env
PORT=4000

WHIPSCRIBE_API_KEY=your_whipscribe_key
WHIPSCRIBE_BASE_URL=https://whipscribe.com/api/v1

AIRTABLE_API_KEY=your_airtable_personal_access_token
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=Scorecards
AIRTABLE_ENABLED=true

AI_API_KEY=your_openai_compatible_key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Your Airtable base ID is the `appXXXXXXXXXXXXXX` segment of your base's URL
when you have it open in the browser.

Start:

```bash
npm run dev
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. The dev server
proxies `/api` to `http://localhost:4000`, so no CORS setup is needed
locally.

### 3. Try it

Use a short (2–5 minute) mock screening call recording, fill in the
candidate/role/interviewer fields, and submit. Watch the new row appear in
your Airtable base once processing finishes.

## Deploying

- Backend: any Node host (Render, Railway, Fly.io) — set the same env vars.
- Frontend: any static host (Vercel, Netlify) — set `VITE_API_BASE` to the
  deployed backend's `/api` URL at build time.

## Important

Never put `WHIPSCRIBE_API_KEY`, `AIRTABLE_API_KEY`, or `AI_API_KEY` in the
frontend. They must remain server-side, which is why every third-party call
happens from the Express backend, not the browser.

## Track 4 submission pieces

- `docs/problem.md` — one-page problem statement
- `docs/workflow.md` — workflow, architecture, and the exact API calls made
- this README — how to run it
- `docs/demo-script.md` — two-minute demo plan
- `docs/vision.md` — one-year vision

## What I learned

- Designing around an asynchronous transcription API (submit → poll →
  fetch).
- Turning unstructured transcript text into a strictly-grounded structured
  JSON output, instead of letting the LLM freewheel.
- Integrating a second, unrelated third-party API (Airtable) in the same
  pipeline, including its own auth (Bearer PAT) and record-creation shape.
- Keeping every credential server-side across two separate integrations.
- Designing for graceful degradation: the product still produces a usable
  scorecard with no LLM key, and still shows the scorecard even if the
  Airtable write fails.
