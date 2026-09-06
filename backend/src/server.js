const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const seedDatabase = require('./config/seed');
const logger = require('./utils/logger');

const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();

    const server = app.listen(env.PORT, () => {
      logger.info(`[Server] Unified Assessment Platform running on http://localhost:${env.PORT}`);
    });

    const shutdown = async () => {
      logger.info('[Server] Shutting down gracefully...');
      server.close(async () => {
        await disconnectDB();
        logger.info('[Database] MongoDB connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('[Server] Failed to initialize server: %s', err.message || err);
    process.exit(1);
  }
};

startServer();
