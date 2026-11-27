/**
 * Base AI Provider Interface & Candidate Open-Source Model Catalog.
 *
 * NOTE: Models are NOT downloaded during foundation phases.
 * Before enabling a candidate model in production, verify its license,
 * hardware requirements, commercial-use terms, and Hugging Face gated access conditions.
 */

const CANDIDATE_MODEL_CATALOG = {
  speechToText: [
    {
      id: 'openai/whisper-small',
      runtime: 'whisper / faster-whisper',
      license: 'MIT',
      commercialUse: true,
      hardwareNotes: 'CPU (int8) or >= 2 GB VRAM GPU',
      hfGated: false,
    },
    {
      id: 'Systran/faster-whisper-medium',
      runtime: 'faster-whisper (CTranslate2)',
      license: 'MIT',
      commercialUse: true,
      hardwareNotes: '>= 4 GB VRAM GPU recommended for low latency',
      hfGated: false,
    },
  ],
  diarization: [
    {
      id: 'pyannote/speaker-diarization-3.1',
      runtime: 'pyannote.audio',
      license: 'MIT (requires accepting Hugging Face gated access conditions)',
      commercialUse: true,
      hardwareNotes: '>= 4 GB VRAM GPU or multi-core CPU',
      hfGated: true,
    },
  ],
  summarizationLlm: [
    {
      id: 'Qwen/Qwen2.5-7B-Instruct',
      runtime: 'Hugging Face Transformers / vLLM',
      license: 'Apache-2.0',
      commercialUse: true,
      hardwareNotes: '>= 16 GB VRAM (FP16) or 6-8 GB (4-bit quantized)',
      hfGated: false,
    },
  ],
  computerVisionProctoring: [
    {
      id: 'mediapipe-blazeface / opencv-haar',
      runtime: 'Event-based CV worker (never general LLM)',
      license: 'Apache-2.0',
      commercialUse: true,
      hardwareNotes: 'CPU-capable on sampled event frames',
      hfGated: false,
    },
  ],
};

class BaseAiProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  async transcribeAndDiarize(_input) {
    throw new Error(`transcribeAndDiarize() not implemented for provider "${this.name}"`);
  }

  async summarizeTranscript(_input) {
    throw new Error(`summarizeTranscript() not implemented for provider "${this.name}"`);
  }

  async analyzeProctoringEvents(_input) {
    throw new Error(`analyzeProctoringEvents() not implemented for provider "${this.name}"`);
  }
}

module.exports = {
  BaseAiProvider,
  CANDIDATE_MODEL_CATALOG,
};
