// Import the validated environment variables and configuration settings module
const env = require('./config/env');
// Import the configured Express application instance containing all middleware and routes
const app = require('./app');
// Destructure database connection and disconnection helper functions from the db configuration
const { connectDB, disconnectDB } = require('./config/db');
// Mongoose ODM for connection state inspection
const mongoose = require('mongoose');
// Import the database seeder function to initialize essential accounts and demo data fixtures
const seedDatabase = require('./config/seed');
// Import the centralized Winston logger utility for structured application logging
const logger = require('./utils/logger');
// Import the centralized EmailService to verify outbound SMTP mailer transport
const emailService = require('./services/email.service');
const { validateSessionEncryptionKey } = require('./utils/sessionCrypto');

// Define an asynchronous function to initialize database connections and start the HTTP server
const startServer = async () => {
  // Begin try block to catch any startup or initialization errors
  try {
    // Validate session encryption key in production
    validateSessionEncryptionKey();

    // Await the establishment of the MongoDB database connection
    await connectDB();
    // Check if database is active before running seeder
    if (mongoose.connection.readyState === 1) {
      // Check if the current environment is not production or if demo data seeding is explicitly enabled
      if (env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true') {
        // Execute the database seeder function to populate initial demo data
        await seedDatabase();
      // Branch executed when running in production mode without explicit demo data seeding
      } else {
        // Log an informational message indicating automated seeding is disabled in production
        logger.info('[Seed] Production mode: Automated demo data seeding disabled.');
      // Close the if-else block for seeding
      }
    } else {
      logger.warn('[Database] Database is not connected. API requests will return HTTP 503 until connection is restored.');
    }

    // Start the Express HTTP server listening on the configured port and define the callback
    const server = app.listen(env.PORT, () => {
      // Log an informational message indicating the server is running along with its URL
      logger.info(`[Server] Unified Assessment Platform running on http://localhost:${env.PORT}`);
      // Inspect whether SMTP host and authentication credentials are provided
      const isSmtpConfigured = emailService.isSmtpConfigured();
      // Log accurate transport host and authentication configuration status
      logger.info(`[EmailService] SMTP Transport: ${process.env.SMTP_HOST ? 'CONFIGURED (' + process.env.SMTP_HOST + ', Auth: ' + (isSmtpConfigured ? 'CONFIGURED' : 'MISSING') + ')' : 'IN-MEMORY FALLBACK (SMTP_HOST not set)'}`);
      // Asynchronously verify transporter connectivity and credentials without blocking server startup
      emailService.verifyConnection()
        .then((result) => {
          if (result.verified) {
            logger.info(`[EmailService] SMTP Transporter Verification: PASS (Mode: ${result.mode})`);
          } else {
            logger.warn(`[EmailService] SMTP Transporter Verification: FAIL (${result.error || 'Handshake unverified'})`);
          }
        })
        .catch((err) => {
          logger.warn(`[EmailService] SMTP Transporter Verification: FAIL (${emailService.sanitizeError(err.message)})`);
        });
    // Close the app.listen listener callback
    });

    // Attach an error event listener to the HTTP server to handle listen errors
    server.on('error', (err) => {
      // Check if the error is due to the port already being in use
      if (err.code === 'EADDRINUSE') {
        // Log an error message alerting that the specified port is already bound
        logger.error(`[Server] Port ${env.PORT} is already in use by another running process.`);
        // Log an explanation suggesting another terminal or background process is using the port
        logger.error(`[Server] Another terminal tab or background node process is currently using port ${env.PORT}.`);
        // Log actionable instructions on how to kill the conflicting process or change the port
        logger.error(`[Server] To free port ${env.PORT}, run: fuser -k ${env.PORT}/tcp (or set a different PORT in backend/.env)`);
      // Branch executed for any server listen error other than EADDRINUSE
      } else {
        // Log the general server listen error message or error object
        logger.error('[Server] Server listen error: %s', err.message || err);
      // Close the error code conditional
      }
      // Terminate the Node.js process with exit code 1 to indicate failure
      process.exit(1);
    // Close the server error event handler
    });

    // Declare a boolean flag to track whether a graceful shutdown sequence is in progress
    let isShuttingDown = false;
    // Define an asynchronous function to handle graceful shutdown upon receiving termination signals
    const shutdown = async (signal) => {
      // Return early if a shutdown sequence is already in progress to avoid duplicate execution
      if (isShuttingDown) return;
      // Set the shutdown flag to true to lock subsequent shutdown attempts
      isShuttingDown = true;
      // Log an informational message indicating the received signal and initiating graceful shutdown
      logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);

      // Set a fallback timer to forcefully exit if graceful shutdown takes longer than 5 seconds
      const forceExitTimer = setTimeout(() => {
        // Log a warning message indicating that the shutdown timed out and force exit is occurring
        logger.warn('[Server] Forceful shutdown initiated after timeout.');
        // Forcefully exit the process with code 1
        process.exit(1);
      // Specify the 5000 millisecond (5 second) timeout duration
      }, 5000);
      // Unref the timer so it does not prevent Node's event loop from exiting naturally
      forceExitTimer.unref();

      // Begin try block to handle graceful connection closing
      try {
        // Check if the server object supports closing idle keep-alive connections
        if (typeof server.closeIdleConnections === 'function') {
          // Immediately close all idle HTTP keep-alive connections
          server.closeIdleConnections();
        // Close the connection check block
        }
        // Wrap server.close in a Promise and await its completion to stop accepting new requests
        await new Promise((resolve) => server.close(resolve));
        // Await the disconnection from MongoDB to close all database connection pools cleanly
        await disconnectDB();
        // Log an informational message confirming that the MongoDB connection has closed
        logger.info('[Database] MongoDB connection closed.');
        // Clear the forceful exit timer since graceful cleanup completed in time
        clearTimeout(forceExitTimer);
        // Check if the shutdown signal was SIGUSR2 (typically sent by nodemon for restarts)
        if (signal === 'SIGUSR2') {
          // Re-emit SIGUSR2 to the current process PID to allow nodemon to continue restarting
          process.kill(process.pid, 'SIGUSR2');
        // Branch executed for standard termination signals like SIGTERM and SIGINT
        } else {
          // Terminate the process cleanly with exit code 0 indicating success
          process.exit(0);
        // Close the signal check block
        }
      // Catch any errors that occur during the graceful shutdown sequence
      } catch (shutdownErr) {
        // Log an error message detailing the failure during graceful shutdown
        logger.error('[Server] Error during graceful shutdown: %s', shutdownErr.message || shutdownErr);
        // Terminate the process with code 1 due to the shutdown error
        process.exit(1);
      // Close the shutdown try-catch block
      }
    // Close the shutdown function definition
    };

    // Listen for the SIGTERM signal (standard termination signal) and invoke graceful shutdown
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    // Listen for the SIGINT signal (Ctrl+C keyboard interrupt) and invoke graceful shutdown
    process.on('SIGINT', () => shutdown('SIGINT'));
    // Listen once for the SIGUSR2 signal (nodemon reload signal) and invoke graceful shutdown
    process.once('SIGUSR2', () => shutdown('SIGUSR2'));
  // Catch any unexpected errors that occur during server initialization
  } catch (err) {
    // Log an error message with details about the server initialization failure
    logger.error('[Server] Failed to initialize server: %s', err.message || err);
    // Terminate the process with code 1 due to initialization failure
    process.exit(1);
  // Close the startServer try-catch block
  }
// Close the startServer function definition
};

// Register a global event listener for unhandled Promise rejections
process.on('unhandledRejection', (reason) => {
  // Log the stack trace or reason for the unhandled Promise rejection
  logger.error('[Server] Unhandled Promise Rejection: %s', reason?.stack || reason);
// Close the unhandledRejection listener callback
});

// Register a global event listener for uncaught synchronous exceptions
process.on('uncaughtException', (err) => {
  // Log the error stack or error message for the uncaught exception
  logger.error('[Server] Uncaught Exception: %s', err.stack || err.message);
  // Terminate the process with code 1 to avoid running in an unstable or unknown state
  process.exit(1);
// Close the uncaughtException listener callback
});

// Invoke the startServer function to initialize and start the application server
startServer();
