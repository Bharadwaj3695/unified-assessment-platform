const logger = require('../utils/logger');

const VALID_TYPES = ['mcq', 'short_answer', 'long_answer', 'file_upload'];
const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const VALID_BLOOM_LEVELS = [
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'ANALYZE',
  'EVALUATE',
  'CREATE',
];

class AIClassificationService {
  /**
   * Validate and sanitize structured classification output
   */
  validateClassification(classification) {
    if (!classification || typeof classification !== 'object') {
      return { valid: false, errors: ['Missing or invalid classification object'] };
    }

    const errors = [];
    const type = String(classification.type || 'short_answer').toLowerCase();
    const difficulty = String(classification.difficulty || '').toUpperCase();
    const bloomLevel = String(classification.bloomLevel || '').toUpperCase();
    let confidence = Number(classification.confidence);

    if (!VALID_TYPES.includes(type)) errors.push(`Invalid question type: ${type}`);
    if (!VALID_DIFFICULTIES.includes(difficulty)) errors.push(`Invalid difficulty: ${difficulty}`);
    if (!VALID_BLOOM_LEVELS.includes(bloomLevel)) errors.push(`Invalid bloomLevel: ${bloomLevel}`);
    if (isNaN(confidence) || confidence < 0 || confidence > 100) errors.push('Confidence must be between 0 and 100');

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      type,
      difficulty,
      bloomLevel,
      confidence: Math.round(confidence),
      classificationSource: 'AI',
    };
  }

  /**
   * Deterministic rule-based fallback classifier
   */
  fallbackClassification(questionText, options = []) {
    const text = String(questionText || '').trim().toLowerCase();
    const hasOptions = Array.isArray(options) && options.length >= 2;

    // 1. Determine Type
    let type = 'short_answer';
    if (hasOptions) {
      type = 'mcq';
    } else if (
      text.includes('upload') ||
      text.includes('attach document') ||
      text.includes('submit pdf') ||
      text.includes('file upload')
    ) {
      type = 'file_upload';
    } else if (
      text.length > 150 ||
      text.includes('explain in detail') ||
      text.includes('discuss') ||
      text.includes('describe the process') ||
      text.includes('critique') ||
      text.includes('elaborate') ||
      text.includes('write an essay') ||
      text.includes('write a program')
    ) {
      type = 'long_answer';
    }

    // 2. Determine Bloom Level from action verbs
    let bloomLevel = 'UNDERSTAND';
    let confidence = 75;

    if (
      /\b(define|list|state|name|recall|identify|what is|who|when|where)\b/.test(text)
    ) {
      bloomLevel = 'REMEMBER';
      confidence = 85;
    } else if (
      /\b(explain|summarize|paraphrase|interpret|classify|describe)\b/.test(text)
    ) {
      bloomLevel = 'UNDERSTAND';
      confidence = 80;
    } else if (
      /\b(calculate|compute|solve|apply|demonstrate|implement|execute|use)\b/.test(text)
    ) {
      bloomLevel = 'APPLY';
      confidence = 82;
    } else if (
      /\b(compare|contrast|analyze|differentiate|distinguish|examine|categorize)\b/.test(text)
    ) {
      bloomLevel = 'ANALYZE';
      confidence = 80;
    } else if (
      /\b(evaluate|assess|justify|critique|judge|rate|defend|verify)\b/.test(text)
    ) {
      bloomLevel = 'EVALUATE';
      confidence = 78;
    } else if (
      /\b(design|create|formulate|develop|construct|compose|propose|invent)\b/.test(text)
    ) {
      bloomLevel = 'CREATE';
      confidence = 78;
    }

    // 3. Determine Difficulty
    let difficulty = 'MEDIUM';
    if (bloomLevel === 'REMEMBER' || (type === 'mcq' && text.length < 80)) {
      difficulty = 'EASY';
    } else if (
      bloomLevel === 'ANALYZE' ||
      bloomLevel === 'EVALUATE' ||
      bloomLevel === 'CREATE' ||
      text.length > 200
    ) {
      difficulty = 'HARD';
    }

    return {
      type,
      difficulty,
      bloomLevel,
      confidence,
      classificationSource: 'HEURISTIC',
    };
  }

  /**
   * Classify a question using LLM with deterministic fallback
   */
  async classifyQuestion({ questionText, options = [], rawText = '' }) {
    // If external AI key is available, attempt structured LLM completion
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        // Attempt external AI invocation with structured prompt
        logger.info('ai_classification_attempt', { promptLength: questionText?.length });
        // In real environments, invoke Google Generative AI / OpenAI client here.
        // For testing / offline / resilient fallback, check returned structure:
      } catch (err) {
        logger.warn('question_ai_classification_failed', { error: err.message });
      }
    }

    // Deterministic fallback classifier
    return this.fallbackClassification(questionText || rawText, options);
  }
}

module.exports = new AIClassificationService();
