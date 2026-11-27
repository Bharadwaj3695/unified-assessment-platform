const { BaseAiProvider, CANDIDATE_MODEL_CATALOG } = require('./base.provider');

class DeterministicStubProvider extends BaseAiProvider {
  constructor(config = {}) {
    super('deterministic_stub', config);
  }

  async transcribeAndDiarize({ utterances = [] }) {
    const safeList = Array.isArray(utterances) ? utterances : [];
    const segments = safeList.map((u, idx) => {
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
    return { segments, provider: this.name };
  }

  async summarizeTranscript({ segments = [], interviewType = 'technical' }) {
    return {
      summary: `Structured ${interviewType} interview transcript (${segments.length} segment(s)) processed by ${this.name}. Ready for faculty review.`,
      provider: this.name,
    };
  }

  async analyzeProctoringEvents({ telemetrySignals = [] }) {
    const signals = Array.isArray(telemetrySignals) ? telemetrySignals : [];
    const events = signals
      .filter((s) => s && typeof s.eventType === 'string')
      .map((s) => ({
        eventType: s.eventType,
        severity: s.severity || 'medium',
        confidence: typeof s.confidence === 'number' ? s.confidence : null,
        durationSeconds: s.durationSeconds,
        faceCount: s.faceCount,
        note: s.note || `Observable telemetry signal (${s.eventType}) queued for faculty review.`,
      }));
    return {
      events,
      behavioralSummaryDraft: `Event-based pipeline recorded ${events.length} observable signal(s). Indicators require faculty review and never determine official grades.`,
      provider: this.name,
    };
  }
}

class LocalOpenWeightProvider extends BaseAiProvider {
  constructor(config = {}) {
    super('local_open_weight', config);
    this.sttModel = config.sttModel || process.env.STT_MODEL_ID || 'Systran/faster-whisper-medium';
    this.diarizationModel =
      config.diarizationModel || process.env.DIARIZATION_MODEL_ID || 'pyannote/speaker-diarization-3.1';
    this.llmModel =
      config.llmModel || process.env.SUMMARY_LLM_MODEL_ID || 'Qwen/Qwen2.5-7B-Instruct';
  }

  async transcribeAndDiarize(_input) {
    throw new Error(
      `Local open-weight runtime (${this.sttModel} / ${this.diarizationModel}) is configured via interface but requires local inference weights to be provisioned.`
    );
  }

  async summarizeTranscript(_input) {
    throw new Error(
      `Local open-weight LLM (${this.llmModel}) requires local inference weights to be provisioned.`
    );
  }

  async analyzeProctoringEvents(_input) {
    throw new Error('Local CV proctoring model requires local runtime weights to be provisioned.');
  }
}

class SelfHostedInferenceProvider extends BaseAiProvider {
  constructor(config = {}) {
    super('self_hosted_inference', config);
    this.endpoint = config.endpoint || process.env.AI_SELF_HOSTED_URL || '';
  }

  async _post(path, payload) {
    if (!this.endpoint) {
      throw new Error('AI_SELF_HOSTED_URL is not configured');
    }
    const res = await fetch(`${this.endpoint.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Self-hosted inference error: HTTP ${res.status}`);
    }
    return res.json();
  }

  async transcribeAndDiarize(input) {
    return this._post('/stt-diarize', input);
  }

  async summarizeTranscript(input) {
    return this._post('/summarize', input);
  }

  async analyzeProctoringEvents(input) {
    return this._post('/cv-proctor', input);
  }
}

class ExternalApiProvider extends BaseAiProvider {
  constructor(config = {}) {
    super('external_api', config);
    this.endpoint = config.endpoint || process.env.AI_EXTERNAL_API_URL || '';
    this.apiKey = config.apiKey || process.env.AI_EXTERNAL_API_KEY || '';
  }

  async _post(path, payload) {
    if (!this.endpoint || !this.apiKey) {
      throw new Error('AI_EXTERNAL_API_URL and AI_EXTERNAL_API_KEY are required for external_api provider');
    }
    const res = await fetch(`${this.endpoint.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`External AI provider error: HTTP ${res.status}`);
    }
    return res.json();
  }

  async transcribeAndDiarize(input) {
    return this._post('/transcribe', input);
  }

  async summarizeTranscript(input) {
    return this._post('/summarize', input);
  }

  async analyzeProctoringEvents(input) {
    return this._post('/proctoring-events', input);
  }
}

function createProvider(providerType = process.env.AI_PROVIDER || 'deterministic_stub', config = {}) {
  switch (providerType) {
    case 'local_open_weight':
      return new LocalOpenWeightProvider(config);
    case 'self_hosted_inference':
      return new SelfHostedInferenceProvider(config);
    case 'external_api':
      return new ExternalApiProvider(config);
    case 'deterministic_stub':
    default:
      return new DeterministicStubProvider(config);
  }
}

module.exports = {
  createProvider,
  DeterministicStubProvider,
  LocalOpenWeightProvider,
  SelfHostedInferenceProvider,
  ExternalApiProvider,
  CANDIDATE_MODEL_CATALOG,
};
