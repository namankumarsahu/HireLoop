# HireLoop

Track 4 submission for the WhipScribe Buildathon.

HireLoop is an AI-powered screening workflow that converts a recruiter screening call into a structured candidate scorecard and automatically stores it in Airtable.

# 🚀 Live Demo

Live application:
https://hire-loop-nvr34pdlr-naman-sahus-projects-a4949ddc.vercel.app/

# Problem

Recruiters often finish a screening call with useful information trapped inside a recording. Turning that conversation into a structured candidate scorecard is usually manual, time-consuming, and easy to delay or skip.

HireLoop closes that gap:

Call recording → WhipScribe transcript → structured scorecard → Airtable row

The first target user is a recruiter or hiring manager who conducts screening calls and manages candidates in Airtable, especially at smaller companies and recruiting agencies without a full ATS.

Instead of manually reviewing a recording and writing a scorecard, HireLoop turns the conversation into a structured, reviewable record that can be added directly to the team's existing Airtable workflow.

# What the MVP Does

The recruiter uploads a screening call recording and provides the candidate name, role, and interviewer.

The recording is sent to the WhipScribe API for transcription.

The backend polls the WhipScribe job until the transcript is ready.

The backend retrieves the transcript and WhipScribe insights.

An LLM converts the transcript into a structured scorecard.

The scorecard is grounded in information actually present in the conversation.

The backend writes the scorecard to an Airtable table.

The recruiter can view the generated scorecard and access the Airtable record.

Generated Scorecard

The scorecard contains:

Summary

Recommendation

Strengths

Concerns

Topics Covered

Follow-up Questions

Red Flags

The WhipScribe API is the essential first step — nothing downstream works
without a real transcript. See the official API docs for the current
endpoint contract.

# Architecture

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

See docs/workflow.md for the full diagram and the exact list of API calls
made per submission.

Running Locally

Requirements

Node.js 20+

A WhipScribe API key with available API credit

A free Airtable account, with:

a base containing a table (default name Scorecards) with these fields:
Candidate Name (single line text), Candidate Email (email),
Role (single line text), Interviewer (single line text),
Recommendation (single line text or single select: Strong Yes / Yes /
No / Strong No), Summary (long text), Strengths (long text),
Concerns (long text), Topics Covered (long text),
Follow-up Questions (long text), Red Flags (long text),
Call Date (date), Source (single line text)

a Personal Access Token from airtable.com/create/tokens with
data.records:read + data.records:write scopes and access granted to
that base

Optional: an OpenAI-compatible API key for LLM scorecard generation (works
without one, using a deterministic fallback, but the scorecard is much
richer with an LLM)

1. Start the backend

cd backend
npm install
cp .env.example .env

Edit .env:

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

Your Airtable base ID is the appXXXXXXXXXXXXXX segment of your base's URL
when you have it open in the browser.

Start:

npm run dev

2. Start the frontend

cd frontend
npm install
npm run dev

Open the URL Vite prints, normally http://localhost:5173. The dev server
proxies /api to http://localhost:4000, so no CORS setup is needed
locally.

3. Try it

Use a short (2–5 minute) mock screening call recording, fill in the
candidate/role/interviewer fields, and submit. Watch the new row appear in
your Airtable base once processing finishes.

Deployment

Backend: any Node host (Render, Railway, Fly.io) — set the same env vars.

Frontend: any static host (Vercel, Netlify) — set VITE_API_BASE to the
deployed backend's /api URL at build time.

# Deployment

Frontend — Vercel

The frontend is deployed on Vercel.

The production frontend uses:

VITE_API_BASE=https://hireloop-4v5y.onrender.com/api

Backend — Render

The backend is deployed on Render.

Third-party credentials remain server-side and are never exposed to the frontend.

Environment Variables

Backend

PORT=4000

WHIPSCRIBE_API_KEY=...
WHIPSCRIBE_BASE_URL=https://whipscribe.com/api/v1

AIRTABLE_API_KEY=...
AIRTABLE_BASE_ID=...
AIRTABLE_TABLE_NAME=Scorecards
AIRTABLE_ENABLED=true

AI_API_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

Frontend

VITE_API_BASE=https://hireloop-4v5y.onrender.com/api

Security

Never put WHIPSCRIBE_API_KEY, AIRTABLE_API_KEY, or AI_API_KEY in the
frontend. They must remain server-side, which is why every third-party call
happens from the Express backend, not the browser.

Key Engineering Challenges

1. Handling an Asynchronous Transcription API

WhipScribe does not immediately return the final transcript. The workflow is:

Submit recording
      ↓
Receive job ID
      ↓
Poll job status
      ↓
Wait until processing completes
      ↓
Fetch transcript
      ↓
Fetch insights

2. Converting Unstructured Conversation Into Structured Data

Interview conversations are unstructured. HireLoop converts the transcript into a structured scorecard containing recommendation, strengths, concerns, topics covered, follow-up questions, and red flags.

3. Integrating Multiple External APIs

The application integrates WhipScribe for transcription and insights and Airtable for persistent scorecard storage. Each integration has its own authentication mechanism, API contract, and failure modes.

4. Keeping Credentials Secure

All third-party credentials are kept on the backend. The browser never receives the WhipScribe, Airtable, or AI API keys.

5. Graceful Failure Handling

The application separates scorecard generation from optional downstream storage, so an Airtable failure does not have to prevent the recruiter from seeing the generated scorecard.

Track 4 Submission Material

docs/problem.md — one-page problem statement

docs/workflow.md — workflow, architecture, and the exact API calls made

this README — how to run it

docs/demo-script.md — two-minute demo plan

docs/vision.md — one-year vision

What I Learned

Designing around an asynchronous transcription API (submit → poll →
fetch).

Turning unstructured transcript text into a strictly-grounded structured
JSON output, instead of letting the LLM freewheel.

Integrating a second, unrelated third-party API (Airtable) in the same
pipeline, including its own auth (Bearer PAT) and record-creation shape.

Keeping every credential server-side across two separate integrations.

Designing for graceful degradation: the product still produces a usable
scorecard with no LLM key, and still shows the scorecard even if the
Airtable write fails.

Future Vision

The current MVP focuses on turning one screening call into one structured candidate scorecard. The longer-term vision is to make HireLoop part of a recruiter's existing hiring workflow.

Screening Call
      ↓
Automatic Transcription
      ↓
Candidate Scorecard
      ↓
ATS / Airtable
      ↓
Candidate Comparison
      ↓
Interview Follow-up

Future versions could integrate with ATS platforms and other recruiting tools, automatically trigger follow-up workflows, provide searchable interview evidence, and help recruiters maintain consistent evaluation records across candidates.

The goal is not to replace the recruiter's judgment, but to remove the manual work required to turn an interview conversation into structured, usable hiring information.

Demo

# Live application:

https://hire-loop-nvr34pdlr-naman-sahus-projects-a4949ddc.vercel.app/

The primary demo flow is:

Upload Recording
       ↓
WhipScribe
       ↓
Transcript
       ↓
AI Scorecard
       ↓
Airtable

WhipScribe Buildathon — Track 4

Core workflow:

Recording → WhipScribe → Structured Scorecard → Airtable
