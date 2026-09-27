import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const STATUS_LABEL = {
  queued: "Queued for transcription…",
  transcribing: "Transcribing with WhipScribe…",
  scoring: "Generating scorecard…",
  pushing_to_airtable: "Writing row to Airtable…",
  ready: "Done",
  error: "Failed"
};

const REC_LABEL = {
  strong_yes: "Strong Yes",
  yes: "Yes",
  no: "No",
  strong_no: "Strong No"
};

function useCallPolling() {
  const [call, setCall] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  async function poll(callId) {
    try {
      const res = await fetch(`${API_BASE}/calls/${callId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setCall(data);

      if (data.status !== "ready" && data.status !== "error") {
        timer.current = setTimeout(() => poll(callId), 2500);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function start(callId) {
    setError(null);
    setCall({ status: "queued" });
    poll(callId);
  }

  return { call, error, start };
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function UploadForm({ onSubmitted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const form = new FormData(e.target);
      const res = await fetch(`${API_BASE}/calls`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onSubmitted(data.callId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>1. Upload the screening call</h2>
      <Field label="Candidate name">
        <input name="candidateName" required placeholder="Jane Doe" />
      </Field>
      <Field label="Candidate email (optional)">
        <input name="candidateEmail" type="email" placeholder="jane@example.com" />
      </Field>
      <Field label="Role">
        <input name="roleTitle" required placeholder="Backend Engineer" />
      </Field>
      <Field label="Interviewer">
        <input name="interviewerName" placeholder="You" />
      </Field>
      <Field label="Call recording (audio or video)">
        <input name="file" type="file" accept="audio/*,video/*" required />
      </Field>
      <button type="submit" disabled={submitting}>
        {submitting ? "Uploading…" : "Transcribe & score this call"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function List({ items }) {
  if (!items || items.length === 0) return <p className="muted">None noted</p>;
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function ScorecardView({ call }) {
  const s = call.scorecard;
  if (!s) return null;

  return (
    <div className="card">
      <h2>2. Scorecard</h2>
      <p className="rec">
        Recommendation: <strong>{REC_LABEL[s.recommendation] || s.recommendation || "—"}</strong>
      </p>
      <p>{s.summary}</p>

      <h3>Strengths</h3>
      <List items={s.strengths} />

      <h3>Concerns</h3>
      <List items={s.concerns} />

      <h3>Topics covered</h3>
      <List items={s.topicsCovered} />

      <h3>Suggested follow-up questions</h3>
      <List items={s.followUpQuestions} />

      {s.redFlags && s.redFlags.length > 0 && (
        <>
          <h3>Red flags</h3>
          <List items={s.redFlags} />
        </>
      )}
    </div>
  );
}

function AirtableStatus({ call }) {
  const a = call.airtable;
  if (!a) return null;

  return (
    <div className="card">
      <h2>3. Airtable</h2>
      {a.skipped && <p className="muted">Skipped: {a.reason}</p>}
      {a.error && <p className="error">Could not write to Airtable: {a.error}</p>}
      {!a.skipped && !a.error && (
        <p>
          Row added to the Scorecards base —{" "}
          <a href={a.baseUrl} target="_blank" rel="noreferrer">
            open in Airtable
          </a>
        </p>
      )}
    </div>
  );
}

function App() {
  const { call, error, start } = useCallPolling();

  return (
    <div className="app">
      <header>
        <h1>HireLoop</h1>
        <p className="tagline">Screening call recording → WhipScribe transcript → structured scorecard → Airtable row.</p>
      </header>

      <UploadForm onSubmitted={start} />

      {call && (
        <div className="card status">
          <strong>Status:</strong> {STATUS_LABEL[call.status] || call.status}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {call?.error && <p className="error">{call.error}</p>}

      {call?.status === "ready" && (
        <>
          <ScorecardView call={call} />
          <AirtableStatus call={call} />
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
