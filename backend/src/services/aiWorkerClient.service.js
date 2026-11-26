/**
 * Client & strict output validation boundary for the separate AI Processing Worker service.
 *
 * Security invariants:
 * - Treats all AI worker outputs as UNTRUSTED data.
 * - Rejects malformed schemas, unrecognized event/speaker types, out-of-range confidence values,
 *   script/injection payloads, or attempts to override official scores/user roles/report publication.
 * - Never embeds API keys or exposes provider credentials to the frontend.
 */

const ALLOWED_OBSERVABLE_EVENTS = new Set([
  'face_not_detected',
  'multiple_faces_detected',
  'camera_unavailable',
  'camera_disconnected',
  'session_interrupted',
  'page_visibility_left',
  'faculty_review_required',
  'suspicious_activity',
]);

const FORBIDDEN_AI_KEYS = new Set([
  'officialScore',
  'passed',
  'role',
  'certificateEligible',
  'published',
  'exec',
  'command',
  '__proto__',
  'constructor',
]);

function containsUnsafeMarkupOrCommand(str) {
  if (typeof str !== 'string') return false;
  return /<\s*script|javascript:|onerror\s*=|onload\s*=/i.test(str);
}

function hasForbiddenKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_AI_KEYS.has(key)) return true;
    if (typeof obj[key] === 'object' && obj[key] !== null && hasForbiddenKeys(obj[key])) {
      return true;
    }
  }
  return false;
}

function validateAiTranscriptOutput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Malformed AI transcript payload: expected object');
  }
  if (hasForbiddenKeys(payload)) {
    throw new Error('Rejected AI payload containing forbidden control fields');
  }
  if (!Array.isArray(payload.segments)) {
    throw new Error('Malformed AI transcript payload: segments array is required');
  }

  const validatedSegments = payload.segments.map((seg, idx) => {
    if (!seg || typeof seg !== 'object' || hasForbiddenKeys(seg)) {
      throw new Error(`Invalid transcript segment at index ${idx}`);
    }
    if (!['faculty', 'student'].includes(seg.speakerRole)) {
      throw new Error(`Invalid speakerRole "${seg.speakerRole}" at segment ${idx}`);
    }
    const text = typeof seg.text === 'string' ? seg.text.trim() : '';
    if (!text || containsUnsafeMarkupOrCommand(text)) {
      throw new Error(`Invalid or unsafe transcript text at segment ${idx}`);
    }
    if (seg.confidence !== undefined && seg.confidence !== null) {
      const conf = Number(seg.confidence);
      if (Number.isNaN(conf) || conf < 0 || conf > 1) {
        throw new Error(`Out-of-range confidence value at segment ${idx}`);
      }
    }
    const status = ['final', 'unclear'].includes(seg.status) ? seg.status : 'final';
    return {
      speakerRole: seg.speakerRole,
      text: status === 'unclear' ? '[unclear]' : text,
      confidence:
        seg.confidence !== undefined && seg.confidence !== null ? Number(seg.confidence) : null,
      status,
      startOffsetSeconds:
        typeof seg.startOffsetSeconds === 'number' && seg.startOffsetSeconds >= 0
          ? seg.startOffsetSeconds
          : idx * 5,
      endOffsetSeconds:
        typeof seg.endOffsetSeconds === 'number' && seg.endOffsetSeconds >= 0
          ? seg.endOffsetSeconds
          : null,
    };
  });

  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  if (containsUnsafeMarkupOrCommand(summary)) {
    throw new Error('Unsafe markup detected in AI summary');
  }

  return {
    segments: validatedSegments,
    summary,
    provider: typeof payload.provider === 'string' ? payload.provider.slice(0, 80) : 'unconfigured',
  };
}

function validateAiProctoringOutput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Malformed AI proctoring payload: expected object');
  }
  if (hasForbiddenKeys(payload)) {
    throw new Error('Rejected AI proctoring payload containing forbidden control fields');
  }
  if (!Array.isArray(payload.events)) {
    throw new Error('Malformed AI proctoring payload: events array is required');
  }

  const validatedEvents = payload.events.map((evt, idx) => {
    if (!evt || typeof evt !== 'object' || hasForbiddenKeys(evt)) {
      throw new Error(`Invalid proctoring event at index ${idx}`);
    }
    if (!ALLOWED_OBSERVABLE_EVENTS.has(evt.eventType)) {
      throw new Error(`Disallowed AI proctoring eventType "${evt.eventType}" at index ${idx}`);
    }
    const severity = ['info', 'low', 'medium', 'high'].includes(evt.severity)
      ? evt.severity
      : 'medium';
    if (evt.confidence !== undefined && evt.confidence !== null) {
      const conf = Number(evt.confidence);
      if (Number.isNaN(conf) || conf < 0 || conf > 1) {
        throw new Error(`Out-of-range confidence at event ${idx}`);
      }
    }
    const note = typeof evt.note === 'string' ? evt.note.trim() : '';
    if (containsUnsafeMarkupOrCommand(note)) {
      throw new Error(`Unsafe markup detected in AI event note at index ${idx}`);
    }
    return {
      eventType: evt.eventType,
      severity,
      confidence:
        evt.confidence !== undefined && evt.confidence !== null ? Number(evt.confidence) : null,
      durationSeconds:
        typeof evt.durationSeconds === 'number' && evt.durationSeconds >= 0
          ? evt.durationSeconds
          : undefined,
      faceCount:
        typeof evt.faceCount === 'number' && evt.faceCount >= 0 ? evt.faceCount : undefined,
      note,
    };
  });

  const behavioralSummaryDraft =
    typeof payload.behavioralSummaryDraft === 'string' ? payload.behavioralSummaryDraft.trim() : '';
  if (containsUnsafeMarkupOrCommand(behavioralSummaryDraft)) {
    throw new Error('Unsafe markup detected in AI behavioral summary draft');
  }

  return {
    events: validatedEvents,
    behavioralSummaryDraft,
    provider: typeof payload.provider === 'string' ? payload.provider.slice(0, 80) : 'unconfigured',
  };
}

class AiWorkerClientService {
  constructor() {
    this.workerUrl = process.env.AI_WORKER_URL || '';
    this.internalApiKey = process.env.AI_WORKER_API_KEY || '';
  }

  async processTranscriptPipeline({ interview, utterances = [], generateSummary = true }) {
    // If external AI worker service is configured, call it over HTTP; otherwise run deterministic schema-safe fallback
    if (this.workerUrl) {
      const response = await fetch(`${this.workerUrl.replace(/\/$/, '')}/api/v1/pipeline/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.internalApiKey ? { 'x-internal-api-key': this.internalApiKey } : {}),
        },
        body: JSON.stringify({
          interviewId: interview._id.toString(),
          interviewType: interview.interviewType,
          utterances,
          generateSummary,
        }),
      });
      if (!response.ok) {
        const err = new Error(`AI worker returned status ${response.status}`);
        err.statusCode = 502;
        throw err;
      }
      const json = await response.json();
      return validateAiTranscriptOutput(json.data || json);
    }

    // Deterministic, zero-model-download schema-validated pipeline when no external worker is attached
    const safeUtterances = Array.isArray(utterances) ? utterances : [];
    const normalizedSegments = safeUtterances.map((u, idx) => {
      const text = typeof u.text === 'string' ? u.text.trim() : '';
      const isUnclear = !text || u.status === 'unclear';
      return {
        speakerRole: u.speakerRole === 'student' ? 'student' : 'faculty',
        text: isUnclear ? '[unclear]' : text,
        confidence: typeof u.confidence === 'number' ? u.confidence : null,
        status: isUnclear ? 'unclear' : 'final',
        startOffsetSeconds: idx * 10,
        endOffsetSeconds: idx * 10 + 8,
      };
    });

    return validateAiTranscriptOutput({
      provider: process.env.AI_PROVIDER || 'deterministic_stub',
      segments: normalizedSegments,
      summary: generateSummary
        ? `Transcript processed (${normalizedSegments.length} segments). Pending faculty review; official scores remain faculty-determined.`
        : '',
    });
  }

  async processProctoringEventsPipeline({ interview, telemetrySignals = [] }) {
    if (this.workerUrl) {
      const response = await fetch(`${this.workerUrl.replace(/\/$/, '')}/api/v1/pipeline/proctoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.internalApiKey ? { 'x-internal-api-key': this.internalApiKey } : {}),
        },
        body: JSON.stringify({
          interviewId: interview._id.toString(),
          telemetrySignals,
        }),
      });
      if (!response.ok) {
        const err = new Error(`AI worker returned status ${response.status}`);
        err.statusCode = 502;
        throw err;
      }
      const json = await response.json();
      return validateAiProctoringOutput(json.data || json);
    }

    const signals = Array.isArray(telemetrySignals) ? telemetrySignals : [];
    const detected = [];
    for (const sig of signals) {
      if (sig && ALLOWED_OBSERVABLE_EVENTS.has(sig.eventType)) {
        detected.push({
          eventType: sig.eventType,
          severity: sig.severity || 'medium',
          confidence: typeof sig.confidence === 'number' ? sig.confidence : null,
          durationSeconds: sig.durationSeconds,
          faceCount: sig.faceCount,
          note: sig.note || `Observable event (${sig.eventType}) flagged for faculty review.`,
        });
      }
    }

    return validateAiProctoringOutput({
      provider: process.env.AI_PROVIDER || 'deterministic_cv_stub',
      events: detected,
      behavioralSummaryDraft: `Observable telemetry summary: ${detected.length} reviewable event(s) logged. Flags are review indicators only and require faculty determination.`,
    });
  }
}

module.exports = new AiWorkerClientService();
module.exports.validateAiTranscriptOutput = validateAiTranscriptOutput;
module.exports.validateAiProctoringOutput = validateAiProctoringOutput;
module.exports.ALLOWED_OBSERVABLE_EVENTS = ALLOWED_OBSERVABLE_EVENTS;
