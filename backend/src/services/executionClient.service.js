const env = require('../config/env');
const logger = require('../utils/logger');

class ExecutionClientService {
  constructor() {
    this.baseUrl = env.EXECUTION_SERVICE_URL;
    this.apiKey = env.EXECUTION_SERVICE_API_KEY;
  }

  /**
   * Helper for internal authenticated requests
   */
  async _request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': this.apiKey,
      },
      signal: AbortSignal.timeout(15000), // 15-second safety timeout on network layer
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      let data;
      try {
        data = await response.json();
      } catch (_jsonErr) {
        data = {
          success: false,
          message: `Unexpected response format from execution service (HTTP ${response.status})`,
        };
      }
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      const causeCode = err.cause?.code || err.code;
      let detailedMessage = `Execution service unavailable: ${err.message}`;

      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        detailedMessage = 'Execution service unavailable: Request timed out after 15 seconds.';
      } else if (causeCode === 'ECONNREFUSED') {
        detailedMessage = `Execution service unavailable: Connection refused on ${this.baseUrl}. Please verify the execution container is running and healthy.`;
      } else if (causeCode === 'ENOTFOUND') {
        detailedMessage = `Execution service unavailable: Host not found (DNS lookup failed for ${this.baseUrl}).`;
      } else if (causeCode === 'ETIMEDOUT') {
        detailedMessage = `Execution service unavailable: Connection timed out to ${this.baseUrl}.`;
      } else if (err.cause?.message) {
        detailedMessage = `Execution service unavailable: ${err.cause.message}`;
      }

      logger.warn(
        `Execution service communication failure (${url}): ${detailedMessage} (code: ${causeCode || err.name || 'UNKNOWN'})`
      );
      return {
        ok: false,
        status: 503,
        data: {
          success: false,
          message: detailedMessage,
          code: causeCode || err.name || 'SERVICE_UNAVAILABLE',
        },
      };
    }
  }

  /**
   * Execute single code test against stdin
   */
  async executeCode({ language, code, stdin = '', expectedOutput = null, timeoutMs = 2000, memoryLimitMb = 256 }) {
    return await this._request('/api/v1/execute', 'POST', {
      language,
      code,
      stdin,
      expectedOutput,
      timeoutMs,
      memoryLimitMb,
    });
  }

  /**
   * Execute SQL query with schema DDL against isolated SQL engine
   */
  async executeSql({ dialect = 'sqlite', schemaDdl = '', query, expectedOutput = null, timeoutMs = 2000 }) {
    return await this._request('/api/v1/execute-sql', 'POST', {
      dialect,
      schemaDdl,
      query,
      expectedOutput,
      timeoutMs,
    });
  }

  /**
   * Execute code or SQL query against a complete suite of test cases
   */
  async executeSuite({ language, code, testCases, schemaDdl = '', timeoutMs = 2000, memoryLimitMb = 256 }) {
    return await this._request('/api/v1/execute-suite', 'POST', {
      language,
      code,
      schemaDdl,
      testCases,
      timeoutMs,
      memoryLimitMb,
    });
  }

  /**
   * Get supported language runtimes from execution service
   */
  async getRuntimes() {
    return await this._request('/api/v1/runtimes', 'GET');
  }

  /**
   * Check execution service health
   */
  async checkHealth() {
    const url = `${this.baseUrl}/health`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      return {
        ok: false,
        status: 503,
        data: { status: 'unreachable', error: err.message },
      };
    }
  }
}

module.exports = new ExecutionClientService();
