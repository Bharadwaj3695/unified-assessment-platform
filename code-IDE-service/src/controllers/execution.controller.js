const jobQueue = require('../services/jobQueue.service');
const dockerRunner = require('../services/dockerRunner.service');
const sqlRunner = require('../services/sqlRunner.service');
const env = require('../config/env');
const { RUNTIMES, SUPPORTED_LANGUAGES, CODE_LANGUAGES, SQL_LANGUAGES } = require('../config/runtimes');
const { validateExecutionPayload, validateTestSuitePayload, validateSqlPayload } = require('../validators/execution.validator');
const logger = require('../utils/logger');

class ExecutionController {
  /**
   * Run code against single input / sample case
   * POST /api/v1/execute
   */
  async executeSingle(req, res) {
    const validation = validateExecutionPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid execution request',
        errors: validation.errors,
      });
    }

    try {
      const result = await jobQueue.runSingle({
        language: req.body.language,
        code: req.body.code || req.body.query,
        stdin: req.body.stdin || '',
        schemaDdl: req.body.schemaDdl,
        expectedOutput: req.body.expectedOutput,
        timeoutMs: req.body.timeoutMs,
        memoryLimitMb: req.body.memoryLimitMb,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('Execution failed with internal error', { error: err.message });
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal execution service error',
        error: err.message,
      });
    }
  }

  /**
   * Dedicated SQL query execution endpoint
   * POST /api/v1/execute-sql
   */
  async executeSql(req, res) {
    const validation = validateSqlPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid SQL execution request',
        errors: validation.errors,
      });
    }

    try {
      const result = await sqlRunner.execute({
        dialect: req.body.dialect || req.body.language || 'sqlite',
        schemaDdl: req.body.schemaDdl || '',
        query: req.body.query || req.body.code,
        expectedOutput: req.body.expectedOutput,
        timeoutMs: req.body.timeoutMs,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('SQL execution failed with internal error', { error: err.message });
      return res.status(500).json({
        success: false,
        message: 'Internal SQL execution service error',
        error: err.message,
      });
    }
  }

  /**
   * Run code against a complete suite of test cases
   * POST /api/v1/execute-suite
   */
  async executeSuite(req, res) {
    const validation = validateTestSuitePayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test suite execution request',
        errors: validation.errors,
      });
    }

    try {
      const result = await jobQueue.runSuite({
        language: req.body.language,
        code: req.body.code || req.body.query,
        schemaDdl: req.body.schemaDdl,
        testCases: req.body.testCases,
        timeoutMs: req.body.timeoutMs,
        memoryLimitMb: req.body.memoryLimitMb,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('Suite execution failed with internal error', { error: err.message });
      return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal execution service error',
        error: err.message,
      });
    }
  }

  /**
   * Get supported language runtimes
   * GET /api/v1/runtimes
   */
  getRuntimes(req, res) {
    const runtimesList = SUPPORTED_LANGUAGES.map((lang) => {
      const r = RUNTIMES[lang];
      return {
        id: r.id,
        name: r.name,
        version: r.version,
        image: r.image,
        compiled: r.compiled,
        starterCode: r.defaultStarter,
      };
    });

    return res.status(200).json({
      success: true,
      data: runtimesList,
    });
  }

  /**
   * Health and readiness probe
   * GET /health
   */
  async health(req, res) {
    const isDockerLive = await dockerRunner.checkDockerAvailability();

    return res.status(200).json({
      status: 'healthy',
      service: 'uap-code-IDE-service',
      uptimeSeconds: Math.floor(process.uptime()),
      docker: {
        connected: isDockerLive,
        mode: isDockerLive ? 'LIVE_DOCKER' : 'SIMULATION_SANDBOX',
      },
      runtimes: {
        all: SUPPORTED_LANGUAGES,
        code: CODE_LANGUAGES,
        sql: SQL_LANGUAGES,
      },
      sqlEngines: {
        sqlite: 'builtin-isolated-memory (active)',
        legacyPostgresql: 'inactive (sql-legacy profile only)',
        legacyMysql: 'inactive (sql-legacy profile only)',
      },
      memoryUsage: process.memoryUsage(),
      activeJobs: jobQueue.activeJobs,
    });
  }
}

module.exports = new ExecutionController();
