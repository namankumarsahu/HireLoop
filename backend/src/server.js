import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 4000);

const whipBaseUrl = (process.env.WHIPSCRIBE_BASE_URL || "https://whipscribe.com/api/v1").replace(/\/$/, "");
const whipKey = process.env.WHIPSCRIBE_API_KEY;

const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;
const airtableTableName = process.env.AIRTABLE_TABLE_NAME || "Scorecards";
const airtableEnabled = String(process.env.AIRTABLE_ENABLED || "true").toLowerCase() !== "false";

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 }
});

// In-memory store. Good enough for a hackathon MVP; swap for a real DB before
// putting this in front of real recruiters.
const calls = new Map();

// ---------------------------------------------------------------------------
// WhipScribe client
// ---------------------------------------------------------------------------

function requireWhipKey() {
  if (!whipKey) {
    const error = new Error("WHIPSCRIBE_API_KEY is not configured. Add it to backend/.env.");
    error.status = 500;
    throw error;
  }
}

async function whipscribe(path, options = {}) {
  requireWhipKey();

  const response = await fetch(`${whipBaseUrl}${path}`, {
    ...options,
    headers: {
      "X-API-Key": whipKey,
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === "string" ? body : body?.message || body?.error || JSON.stringify(body);
    const error = new Error(`WhipScribe API ${response.status}: ${message}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollJob(jobId) {
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const job = await whipscribe(`/jobs/${jobId}`);

    if (job.status === "done" || job.status === "completed") {
      return job;
    }

    if (job.status === "failed" || job.status === "error") {
      throw new Error(`WhipScribe transcription failed: ${job.error || job.message || "unknown error"}`);
    }

    await sleep(3000);
  }

  throw new Error("WhipScribe job timed out while waiting for completion.");
}

// ---------------------------------------------------------------------------
// Scorecard extraction (LLM with a deterministic fallback)
// ---------------------------------------------------------------------------

const SCORECARD_SCHEMA_HINT = `{
  "summary": "2-3 sentence overview of how the call went",
  "recommendation": "strong_yes | yes | no | strong_no",
  "strengths": ["short bullet", "..."],
  "concerns": ["short bullet", "..."],
  "topicsCovered": ["topic the interviewer actually asked about", "..."],
  "followUpQuestions": ["question the next interviewer should ask", "..."],
  "redFlags": ["only include real concerns, otherwise leave empty"]
}`;

function fallbackScorecard(transcript, insights, meta) {
  const text = transcript?.text || "";

  const topics = Array.isArray(insights?.topics)
    ? insights.topics
        .map(t => (typeof t === "string" ? t : t.title || t.name || t.topic))
        .filter(Boolean)
    : [];

  const strengths = [];
  const concerns = [];
  const followUpQuestions = [];
  const redFlags = [];

  // Detect evidence from the transcript.
  if (/\b(experience|worked|previous role|years of experience|internship)\b/i.test(text)) {
    strengths.push("Relevant experience was discussed.");
  }

  if (/\b(degree|graduated|education|university|college)\b/i.test(text)) {
    strengths.push("Educational background was discussed.");
  }

  if (/\b(lead|led|leadership|managed|management|team)\b/i.test(text)) {
    strengths.push("Leadership or teamwork experience was discussed.");
  }

  if (/\b(project|built|developed|created|implemented)\b/i.test(text)) {
    strengths.push("Hands-on project or implementation experience was discussed.");
  }

  if (/\b(communication|communicate|explained|presentation)\b/i.test(text)) {
    strengths.push("Communication skills were discussed.");
  }

  if (/\b(motivated|motivation|interested|passionate|excited|why this role)\b/i.test(text)) {
    strengths.push("Motivation or interest in the role was discussed.");
  }

  // Detect potential concerns only when there is actual evidence.
  if (/\b(no experience|never worked|don't know|do not know|not familiar)\b/i.test(text)) {
    concerns.push("The candidate mentioned a potential experience or knowledge gap.");
  }

  if (/\b(unable to|couldn't|cannot|can't)\b/i.test(text)) {
    concerns.push("The candidate mentioned a limitation that may need follow-up.");
  }

  // Combine WhipScribe topics with deterministic topic detection.
  const detectedTopics = [...topics];

  const topicRules = [
    ["Education", /\b(degree|graduated|education|university|college)\b/i],
    ["Work Experience", /\b(experience|worked|previous role|employment|job)\b/i],
    ["Projects", /\b(project|built|developed|created|implemented)\b/i],
    ["Leadership & Teamwork", /\b(team|leadership|managed|led)\b/i],
    ["Communication", /\b(communication|communicate|presentation|explained)\b/i],
    ["Motivation", /\b(motivation|motivated|interested|passionate|why this role)\b/i],
    ["Technical Skills", /\b(software|programming|coding|technical|technology|developer)\b/i]
  ];

  for (const [topic, pattern] of topicRules) {
    if (pattern.test(text) && !detectedTopics.includes(topic)) {
      detectedTopics.push(topic);
    }
  }

  // Generate useful follow-up questions based on missing evidence.
  if (!/\b(project|built|developed|created)\b/i.test(text)) {
    followUpQuestions.push(
      "Can you describe a project or piece of work you are most proud of?"
    );
  }

  if (!/\b(experience|worked|previous role)\b/i.test(text)) {
    followUpQuestions.push(
      "Can you describe your most relevant previous experience for this role?"
    );
  }

  if (!/\b(team|leadership|managed|led)\b/i.test(text)) {
    followUpQuestions.push(
      "Tell us about a time you worked with or led a team."
    );
  }

  if (!/\b(challenge|difficult|problem|conflict)\b/i.test(text)) {
    followUpQuestions.push(
      "Tell us about a difficult problem you faced and how you solved it."
    );
  }

  if (!/\b(motivation|motivated|interested|passionate)\b/i.test(text)) {
    followUpQuestions.push(
      `Why are you interested in the ${meta.roleTitle} role?`
    );
  }

  // Only report red flags when there is explicit evidence.
  if (/\b(lied|fake|fraud|dishonest|misrepresented)\b/i.test(text)) {
    redFlags.push("The transcript contains an explicit integrity-related concern.");
  }

  // Conservative recommendation heuristic.
  // This is a screening aid, not an automatic hiring decision.
  let recommendation = "yes";

  if (redFlags.length > 0) {
    recommendation = "no";
  } else if (strengths.length >= 4 && concerns.length === 0) {
    recommendation = "strong_yes";
  } else if (concerns.length >= 2) {
    recommendation = "no";
  }

  return {
    summary:
      insights?.summary ||
      (text
        ? `${text.slice(0, 500)}${text.length > 500 ? "…" : ""}`
        : "Transcript ready. Review the full transcript for additional evidence."),

    recommendation,

    strengths: strengths.length
      ? strengths.slice(0, 6)
      : ["No specific strength was confidently identified from the transcript."],

    concerns: concerns.length
      ? concerns.slice(0, 5)
      : ["No specific concern was confidently identified from the transcript."],

    topicsCovered: detectedTopics.slice(0, 10),

    followUpQuestions: followUpQuestions.slice(0, 5),

    redFlags,

    note:
      "Deterministic screening analysis generated from the transcript. " +
      "Use the scorecard as a review aid rather than an automatic hiring decision."
  };
}
async function buildScorecard(transcript, insights, meta) {
  const groqKey = process.env.GROQ_API_KEY;

  // Use Groq when a key is configured; otherwise keep the deterministic fallback.
  if (!groqKey) return fallbackScorecard(transcript, insights, meta);

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const userPrompt = [
    `You are analyzing a recruiting screening call for the role "${meta.roleTitle}".`,
    `Candidate: ${meta.candidateName}. Interviewer: ${meta.interviewerName || "unknown"}.`,
    "Create a structured hiring scorecard as JSON using exactly this schema:",
    SCORECARD_SCHEMA_HINT,
    "Base every field strictly on evidence in the transcript. Do not invent skills, experience, opinions, or concerns.",
    "For strengths and concerns, explain the evidence briefly.",
    "For topicsCovered, include only topics actually discussed.",
    "For followUpQuestions, ask useful questions about gaps or areas that need clarification.",
    "For redFlags, include only explicit and well-supported concerns. Otherwise use an empty array.",
    "Keep the recommendation evidence-based. It is a screening aid, not a final hiring decision.",
    "Return valid JSON only. Do not wrap it in markdown.",
    "---- TRANSCRIPT ----",
    transcript?.text || JSON.stringify(transcript?.segments || []),
    insights?.summary
      ? `---- WHIPSCRIBE INSIGHTS SUMMARY ----\n${insights.summary}`
      : ""
  ].join("\n\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a careful recruiting-screening assistant. Return only valid JSON matching the requested schema."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn(
        "Groq scorecard generation failed, using deterministic fallback:",
        response.status,
        data?.error?.message || JSON.stringify(data)
      );
      return fallbackScorecard(transcript, insights, meta);
    }

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return fallbackScorecard(transcript, insights, meta);
    }

    const parsed = JSON.parse(content);

    return {
      ...fallbackScorecard(transcript, insights, meta),
      ...parsed,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      topicsCovered: Array.isArray(parsed.topicsCovered) ? parsed.topicsCovered : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions)
        ? parsed.followUpQuestions
        : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : []
    };
  } catch (error) {
    console.warn(
      "Groq scorecard generation failed, using deterministic fallback:",
      error.message
    );
    return fallbackScorecard(transcript, insights, meta);
  }
}

// ---------------------------------------------------------------------------
// Airtable client
// ---------------------------------------------------------------------------
//
// Each screening call becomes one row in an Airtable base. This is a plain
// "create a record" integration — no search/match step needed, since every
// call is its own log entry that the hiring team can filter/sort later.

function requireAirtableConfig() {
  if (!airtableApiKey || !airtableBaseId) {
    const error = new Error("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in backend/.env.");
    error.status = 500;
    throw error;
  }
}

const REC_LABEL = {
  strong_yes: "Strong Yes",
  yes: "Yes",
  no: "No",
  strong_no: "Strong No"
};

function bulletJoin(items) {
  return Array.isArray(items) && items.length ? items.map(i => `• ${i}`).join("\n") : "";
}

async function pushScorecardToAirtable(call) {
  if (!airtableEnabled) {
    return { skipped: true, reason: "AIRTABLE_ENABLED=false (dry run)" };
  }

  requireAirtableConfig();

  const s = call.scorecard;
  const fields = {
    "Candidate Name": call.candidateName,
    "Candidate Email": call.candidateEmail || "",
    "Role": call.roleTitle,
    "Interviewer": call.interviewerName || "",
    "Recommendation": REC_LABEL[s.recommendation] || s.recommendation || "",
    "Summary": s.summary || "",
    "Strengths": bulletJoin(s.strengths),
    "Concerns": bulletJoin(s.concerns),
    "Topics Covered": bulletJoin(s.topicsCovered),
    "Follow-up Questions": bulletJoin(s.followUpQuestions),
    "Red Flags": bulletJoin(s.redFlags),
    "Call Date": new Date().toISOString().slice(0, 10)
   
  };

  const url = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${airtableApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true
    })
  });

  const json = await response.json();

  if (!response.ok) {
    const message = json?.error?.message || `Airtable API ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const record = json.records?.[0];

  return {
    skipped: false,
    recordId: record?.id,
    baseUrl: `https://airtable.com/${airtableBaseId}`
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "screenscribe" });
});

app.post("/api/calls", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please upload a call recording (audio or video)." });

    const { candidateName, candidateEmail, roleTitle, interviewerName } = req.body;
    if (!candidateName || !roleTitle) {
      return res.status(400).json({ error: "candidateName and roleTitle are required." });
    }

    const id = crypto.randomUUID();

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    form.append("diarize", "true");
    form.append("word_timestamps", "true");
    form.append("source", "api");

    const submitted = await whipscribe("/transcribe", {
      method: "POST",
      body: form
    });

    calls.set(id, {
      id,
      filename: req.file.originalname,
      status: "queued",
      jobId: submitted.job_id,
      candidateName,
      candidateEmail: candidateEmail || null,
      roleTitle,
      interviewerName: interviewerName || null
    });

    res.status(202).json({ callId: id, jobId: submitted.job_id, status: submitted.status || "queued" });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get("/api/calls/:id", async (req, res) => {
  try {
    const call = calls.get(req.params.id);
    if (!call) return res.status(404).json({ error: "Call not found." });

    if (call.status === "ready" || call.status === "error") {
      return res.json(call);
    }

    call.status = "transcribing";
    await pollJob(call.jobId);

    const transcript = await whipscribe(`/jobs/${call.jobId}/result?format=json`);
    let insights = {};
    try {
      insights = await whipscribe(`/jobs/${call.jobId}/insights`);
    } catch (error) {
      console.warn("Insights unavailable, continuing with transcript only:", error.message);
    }

    call.status = "scoring";
    const scorecard = await buildScorecard(transcript, insights, call);

    call.transcript = transcript;
    call.insights = insights;
    call.scorecard = scorecard;

    call.status = "pushing_to_airtable";
    try {
      call.airtable = await pushScorecardToAirtable(call);
    } catch (error) {
      console.error("Airtable push failed:", error.message);
      call.airtable = { skipped: false, error: error.message };
    }

    call.status = "ready";
    calls.set(call.id, call);

    res.json(call);
  } catch (error) {
    console.error(error);
    const call = calls.get(req.params.id);
    if (call) {
      call.status = "error";
      call.error = error.message;
    }
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Manual retry, useful in a demo if the Airtable push failed the first time
// (e.g. base wasn't ready yet, transient network error).
app.post("/api/calls/:id/push-to-airtable", async (req, res) => {
  try {
    const call = calls.get(req.params.id);
    if (!call) return res.status(404).json({ error: "Call not found." });
    if (!call.scorecard) return res.status(400).json({ error: "Scorecard not ready yet." });

    call.airtable = await pushScorecardToAirtable(call);
    calls.set(call.id, call);
    res.json(call);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`ScreenScribe API running on http://localhost:${port}`);
});


