const { SUPPORTED_LANGUAGES, RUNTIMES } = require('../config/runtimes');
const env = require('../config/env');

/**
 * Validates a single code execution payload
 */
function validateExecutionPayload(body) {
  const errors = [];

  if (!body) {
    return { valid: false, errors: ['Request body cannot be empty'] };
  }

  const { language, code, stdin, timeoutMs, memoryLimitMb } = body;

  // Language check
  if (!language || typeof language !== 'string') {
    errors.push('Language is required and must be a string');
  } else {
    const langLower = language.toLowerCase();
    if (['postgresql', 'postgres', 'mysql'].includes(langLower)) {
      errors.push(`Language '${language}' is rejected at API boundary. Active SQL examination is restricted to SQLite only.`);
    } else if (!SUPPORTED_LANGUAGES.includes(langLower)) {
      errors.push(`Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    }
  }

  // Code check
  if (code === undefined || code === null || typeof code !== 'string') {
    errors.push('Code is required and must be a string');
  } else if (code.trim().length === 0) {
    errors.push('Code cannot be empty');
  } else if (Buffer.byteLength(code, 'utf8') > env.MAX_OUTPUT_BYTES) {
    errors.push(`Code exceeds maximum allowed size of ${env.MAX_OUTPUT_BYTES} bytes`);
  }

  // Stdin check
  if (stdin !== undefined && stdin !== null) {
    if (typeof stdin !== 'string') {
      errors.push('Stdin must be a string if provided');
    } else if (Buffer.byteLength(stdin, 'utf8') > env.MAX_OUTPUT_BYTES) {
      errors.push(`Stdin exceeds maximum allowed size of ${env.MAX_OUTPUT_BYTES} bytes`);
    }
  }

  // Timeout check
  if (timeoutMs !== undefined && timeoutMs !== null) {
    const t = Number(timeoutMs);
    if (!Number.isInteger(t) || t < 500 || t > env.MAX_TIMEOUT_MS) {
      errors.push(`timeoutMs must be an integer between 500 and ${env.MAX_TIMEOUT_MS}`);
    }
  }

  // Memory check
  if (memoryLimitMb !== undefined && memoryLimitMb !== null) {
    const m = Number(memoryLimitMb);
    if (!Number.isInteger(m) || m < 64 || m > env.MAX_MEMORY_MB) {
      errors.push(`memoryLimitMb must be an integer between 64 and ${env.MAX_MEMORY_MB}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a test suite execution payload
 */
function validateTestSuitePayload(body) {
  const baseValidation = validateExecutionPayload(body);
  const errors = [...baseValidation.errors];

  if (!Array.isArray(body.testCases) || body.testCases.length === 0) {
    errors.push('testCases must be a non-empty array of test cases');
  } else {
    body.testCases.forEach((tc, idx) => {
      if (!tc || typeof tc !== 'object') {
        errors.push(`testCases[${idx}] must be an object`);
      } else if (tc.expectedOutput === undefined && !tc.expectedColumns && !tc.expectedRows) {
        errors.push(`testCases[${idx}] missing expectedOutput`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an SQL execution payload
 */
function validateSqlPayload(body) {
  const errors = [];

  if (!body) {
    return { valid: false, errors: ['Request body cannot be empty'] };
  }

  const dialect = (body.dialect || body.language || 'sqlite').toLowerCase();
  if (['postgresql', 'postgres', 'mysql'].includes(dialect)) {
    errors.push(`SQL dialect '${dialect}' is rejected at API boundary. Active SQL examination is restricted to SQLite only.`);
  } else if (dialect !== 'sqlite') {
    errors.push(`Unsupported SQL dialect '${dialect}'. Active SQL examination supports SQLite only.`);
  }

  const query = body.query || body.code;
  if (query === undefined || query === null || typeof query !== 'string') {
    errors.push('Query is required and must be a string');
  } else if (query.trim().length === 0) {
    errors.push('Query cannot be empty');
  } else if (Buffer.byteLength(query, 'utf8') > env.MAX_OUTPUT_BYTES) {
    errors.push(`Query exceeds maximum allowed size of ${env.MAX_OUTPUT_BYTES} bytes`);
  }

  if (body.schemaDdl !== undefined && body.schemaDdl !== null) {
    if (typeof body.schemaDdl !== 'string') {
      errors.push('schemaDdl must be a string if provided');
    } else if (Buffer.byteLength(body.schemaDdl, 'utf8') > env.MAX_OUTPUT_BYTES * 2) {
      errors.push('schemaDdl exceeds maximum allowed size');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateExecutionPayload,
  validateTestSuitePayload,
  validateSqlPayload,
};
