const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const dockerRunner = require('./services/dockerRunner.service');
const redisQueue = require('./queue/redisQueue.service');

const server = app.listen(env.PORT, async () => {
  logger.info(`UAP Execution Service listening on port ${env.PORT} in ${env.NODE_ENV} mode.`);
  await dockerRunner.checkDockerAvailability();
  if (env.USE_REDIS_QUEUE && !redisQueue.isConnected) {
    redisQueue.initRedis();
  }
});

// Graceful termination
const handleShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down execution service gracefully...`);
  server.close(() => {
    logger.info('Execution service HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forceful shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
