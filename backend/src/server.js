const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const seedDatabase = require('./config/seed');
const logger = require('./utils/logger');

const startServer = async () => {
  try {
    await connectDB();
    if (env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true') {
      await seedDatabase();
    } else {
      logger.info('[Seed] Production mode: Automated demo data seeding disabled.');
    }

    const server = app.listen(env.PORT, () => {
      logger.info(`[Server] Unified Assessment Platform running on http://localhost:${env.PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`[Server] Port ${env.PORT} is already in use by another running process.`);
        logger.error(`[Server] Another terminal tab or background node process is currently using port ${env.PORT}.`);
        logger.error(`[Server] To free port ${env.PORT}, run: fuser -k ${env.PORT}/tcp (or set a different PORT in backend/.env)`);
      } else {
        logger.error('[Server] Server listen error: %s', err.message || err);
      }
      process.exit(1);
    });

    let isShuttingDown = false;
    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);

      const forceExitTimer = setTimeout(() => {
        logger.warn('[Server] Forceful shutdown initiated after timeout.');
        process.exit(1);
      }, 5000);
      forceExitTimer.unref();

      try {
        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }
        await new Promise((resolve) => server.close(resolve));
        await disconnectDB();
        logger.info('[Database] MongoDB connection closed.');
        clearTimeout(forceExitTimer);
        if (signal === 'SIGUSR2') {
          process.kill(process.pid, 'SIGUSR2');
        } else {
          process.exit(0);
        }
      } catch (shutdownErr) {
        logger.error('[Server] Error during graceful shutdown: %s', shutdownErr.message || shutdownErr);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGUSR2', () => shutdown('SIGUSR2'));
  } catch (err) {
    logger.error('[Server] Failed to initialize server: %s', err.message || err);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  logger.error('[Server] Unhandled Promise Rejection: %s', reason?.stack || reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[Server] Uncaught Exception: %s', err.stack || err.message);
  process.exit(1);
});

startServer();
