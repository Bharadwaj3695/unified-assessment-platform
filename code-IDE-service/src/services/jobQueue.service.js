const env = require('../config/env');
const dockerRunner = require('./dockerRunner.service');
const sqlRunner = require('./sqlRunner.service');
const { SQL_LANGUAGES } = require('../config/runtimes');
const logger = require('../utils/logger');

class JobQueueService {
  constructor() {
    this.activeJobs = 0;
    this.maxConcurrent = env.MAX_CONCURRENT_JOBS;
  }

  /**
   * Run a single code execution through the runner
   */
  async runSingle(job) {
    while (this.activeJobs >= this.maxConcurrent) {
      await new Promise((res) => setTimeout(res, 50));
    }

    this.activeJobs++;
    try {
      logger.info('Starting execution job', {
        language: job.language,
        timeoutMs: job.timeoutMs,
        memoryLimitMb: job.memoryLimitMb,
        activeJobs: this.activeJobs,
      });

      const lang = (job.language || '').toLowerCase();
      if (SQL_LANGUAGES.includes(lang)) {
        return await sqlRunner.execute({
          dialect: lang,
          schemaDdl: job.schemaDdl,
          query: job.code || job.query,
          expectedOutput: job.expectedOutput,
          timeoutMs: job.timeoutMs,
        });
      }

      const result = await dockerRunner.execute(job);
      return result;
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Run a suite of test cases against a submission
   */
  async runSuite({ language, code, testCases, timeoutMs, memoryLimitMb, schemaDdl = '' }) {
    const results = [];
    let passedCount = 0;
    let totalWeight = 0;
    let passedWeight = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const weight = typeof tc.weight === 'number' && tc.weight > 0 ? tc.weight : 1;
      totalWeight += weight;

      // Handle SQL vs standard code runner
      let combinedDdl = tc.schemaDdl || '';
      if (!combinedDdl && schemaDdl) {
        const seed = tc.seedData || tc.input || '';
        combinedDdl = seed && seed.trim().length > 0 ? `${schemaDdl}\n${seed}` : schemaDdl;
      }

      const expectedOut =
        tc.expectedColumns?.length > 0 || tc.expectedRows?.length > 0
          ? { columns: tc.expectedColumns || [], rows: tc.expectedRows || [], ordered: true }
          : tc.expectedOutput;

      const runResult = await this.runSingle({
        language,
        code,
        stdin: tc.input || '',
        schemaDdl: combinedDdl,
        expectedOutput: expectedOut,
        timeoutMs: tc.timeoutMs || timeoutMs,
        memoryLimitMb: tc.memoryLimitMb || memoryLimitMb,
      });

      const passed = runResult.verdict === 'ACCEPTED';
      if (passed) {
        passedCount++;
        passedWeight += weight;
      }

      results.push({
        testCaseIndex: i,
        input: tc.isHidden ? '[HIDDEN]' : tc.input,
        expectedOutput: tc.isHidden ? '[HIDDEN]' : tc.expectedOutput,
        actualOutput: tc.isHidden ? (passed ? '[HIDDEN]' : 'Output differed') : runResult.stdout,
        stderr: tc.isHidden ? '' : (runResult.stderr || ''),
        passed,
        verdict: runResult.verdict,
        executionTimeMs: runResult.executionTimeMs,
        memoryUsedBytes: runResult.memoryUsedBytes,
        weight,
        isHidden: Boolean(tc.isHidden),
      });

      // Stop on first failure if configured, or continue testing all cases
      // In academic assessments, we typically run all test cases to award partial marks
    }

    const overallVerdict =
      passedCount === testCases.length
        ? 'ACCEPTED'
        : passedCount === 0
        ? results[0]?.verdict || 'WRONG_ANSWER'
        : 'PARTIAL_SUCCESS';

    return {
      verdict: overallVerdict,
      totalCount: testCases.length,
      passedCount,
      totalWeight,
      passedWeight,
      scoreFraction: totalWeight > 0 ? passedWeight / totalWeight : 0,
      testCases: results,
    };
  }
}

module.exports = new JobQueueService();
