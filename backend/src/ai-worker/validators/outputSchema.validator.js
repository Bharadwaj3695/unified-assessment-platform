const ALLOWED_EVENTS = new Set([
  'face_not_detected',
  'multiple_faces_detected',
  'camera_unavailable',
  'camera_disconnected',
  'session_interrupted',
  'page_visibility_left',
  'faculty_review_required',
  'suspicious_activity',
]);

const FORBIDDEN_KEYS = new Set([
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

function hasUnsafeContent(str) {
  return typeof str === 'string' && /<\s*script|javascript:|onerror\s*=|onload\s*=/i.test(str);
}

function hasForbiddenKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (typeof obj[key] === 'object' && obj[key] !== null && hasForbiddenKeys(obj[key])) {
      return true;
    }
  }
  return false;
}

function validateTranscriptPipelineOutput(output) {
  if (!output || typeof output !== 'object' || hasForbiddenKeys(output)) {
    throw new Error('Invalid or forbidden AI transcript output structure');
  }
  if (!Array.isArray(output.segments)) {
    throw new Error('AI transcript output must contain segments array');
  }

  const segments = output.segments.map((seg, i) => {
    if (!seg || typeof seg !== 'object' || hasForbiddenKeys(seg)) {
      throw new Error(`Invalid segment at ${i}`);
    }
    if (!['faculty', 'student'].includes(seg.speakerRole)) {
      throw new Error(`Invalid speakerRole at ${i}`);
    }
    const text = typeof seg.text === 'string' ? seg.text.trim() : '';
    if (!text || hasUnsafeContent(text)) {
      throw new Error(`Unsafe or empty segment text at ${i}`);
    }
    if (seg.confidence !== undefined && seg.confidence !== null) {
      const c = Number(seg.confidence);
      if (Number.isNaN(c) || c < 0 || c > 1) {
        throw new Error(`Invalid confidence at ${i}`);
      }
    }
    return {
      speakerRole: seg.speakerRole,
      text: seg.status === 'unclear' ? '[unclear]' : text,
      confidence: seg.confidence ?? null,
      status: seg.status === 'unclear' ? 'unclear' : 'final',
      startOffsetSeconds: typeof seg.startOffsetSeconds === 'number' ? seg.startOffsetSeconds : i * 5,
      endOffsetSeconds: typeof seg.endOffsetSeconds === 'number' ? seg.endOffsetSeconds : null,
    };
  });

  const summary = typeof output.summary === 'string' ? output.summary.trim() : '';
  if (hasUnsafeContent(summary)) {
    throw new Error('Unsafe content in AI summary');
  }

  return {
    segments,
    summary,
    provider: String(output.provider || 'unknown'),
  };
}

function validateProctoringPipelineOutput(output) {
  if (!output || typeof output !== 'object' || hasForbiddenKeys(output)) {
    throw new Error('Invalid or forbidden AI proctoring output structure');
  }
  if (!Array.isArray(output.events)) {
    throw new Error('AI proctoring output must contain events array');
  }

  const events = output.events.map((evt, i) => {
    if (!evt || typeof evt !== 'object' || hasForbiddenKeys(evt)) {
      throw new Error(`Invalid event at ${i}`);
    }
    if (!ALLOWED_EVENTS.has(evt.eventType)) {
      throw new Error(`Disallowed eventType "${evt.eventType}" at ${i}`);
    }
    if (evt.confidence !== undefined && evt.confidence !== null) {
      const c = Number(evt.confidence);
      if (Number.isNaN(c) || c < 0 || c > 1) {
        throw new Error(`Invalid confidence at ${i}`);
      }
    }
    const note = typeof evt.note === 'string' ? evt.note.trim() : '';
    if (hasUnsafeContent(note)) {
      throw new Error(`Unsafe note at ${i}`);
    }
    return {
      eventType: evt.eventType,
      severity: ['info', 'low', 'medium', 'high'].includes(evt.severity) ? evt.severity : 'medium',
      confidence: evt.confidence ?? null,
      durationSeconds: typeof evt.durationSeconds === 'number' ? evt.durationSeconds : undefined,
      faceCount: typeof evt.faceCount === 'number' ? evt.faceCount : undefined,
      note,
    };
  });

  const behavioralSummaryDraft =
    typeof output.behavioralSummaryDraft === 'string' ? output.behavioralSummaryDraft.trim() : '';
  if (hasUnsafeContent(behavioralSummaryDraft)) {
    throw new Error('Unsafe content in behavioralSummaryDraft');
  }

  return {
    events,
    behavioralSummaryDraft,
    provider: String(output.provider || 'unknown'),
  };
}

module.exports = {
  validateTranscriptPipelineOutput,
  validateProctoringPipelineOutput,
};
