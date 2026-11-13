/**
 * Dedicated Independent Execution Worker Process
 * Consumes jobs from Redis queue and coordinates ephemeral runner containers
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const dockerRunner = require('../services/dockerRunner.service');
const jobQueue = require('../services/jobQueue.service');
const redisQueue = require('../queue/redisQueue.service');

let isRunning = true;

async function startWorker() {
  logger.info('Starting UAP Execution Worker Process...', {
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    maxConcurrent: env.MAX_CONCURRENT_JOBS,
  });

  // Verify Docker Daemon availability
  const isDockerLive = await dockerRunner.checkDockerAvailability();
  if (isDockerLive) {
    logger.info('Execution Worker: Docker daemon verified and ready for container orchestration.');
  } else {
    logger.warn('Execution Worker: Docker daemon not detected. Operating in sandboxed fallback mode.');
  }

  // Ensure Redis connection is active
  if (!redisQueue.client) {
    redisQueue.initRedis();
  }
  for (let i = 0; i < 25 && !redisQueue.isConnected; i++) {
    await new Promise((res) => setTimeout(res, 200));
  }

  logger.info('Execution Worker: Listening for incoming execution jobs on Redis queue...');

  // Worker Loop
  while (isRunning) {
    try {
      const job = await redisQueue.popNextJob(2);
      if (job && job.jobId) {
        logger.info('Execution Worker: Picked up execution job', {
          jobId: job.jobId,
          type: job.type,
          language: job.language,
        });

        try {
          const result = await jobQueue.processJobDirectly(job);
          await redisQueue.publishResult(job.jobId, result);
          logger.info('Execution Worker: Job completed and result published', {
            jobId: job.jobId,
            verdict: result.verdict,
            executionTimeMs: result.executionTimeMs,
          });
        } catch (execErr) {
          logger.error('Execution Worker: Job execution error', {
            jobId: job.jobId,
            error: execErr.message,
          });

          const failureResult = {
            jobId: job.jobId,
            verdict: 'SYSTEM_ERROR',
            exitCode: -1,
            stdout: '',
            stderr: `Execution worker error: ${execErr.message}`,
            outputTruncated: false,
            executionTimeMs: 0,
            memoryUsedBytes: 0,
            mode: 'WORKER_FAILURE',
          };
          await redisQueue.publishResult(job.jobId, failureResult);
        }
      }
    } catch (loopErr) {
      if (isRunning) {
        logger.warn(`Execution Worker consumer loop encountered transient error: ${loopErr.message}`);
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  logger.info('Execution Worker Process terminated gracefully.');
}

// Graceful shutdown handlers
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down Execution Worker...`);
  isRunning = false;
  await redisQueue.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorker().catch((err) => {
  logger.error('Fatal error starting Execution Worker:', { error: err.message, stack: err.stack });
  process.exit(1);
});
