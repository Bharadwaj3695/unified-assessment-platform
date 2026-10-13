// Import Winston logging library for structured application logging and log level management
const winston = require('winston');

// Configure and instantiate the primary application logger instance
const logger = winston.createLogger({
  // Minimum severity level to capture; defaults to 'info' if not specified in environment
  level: process.env.LOG_LEVEL || 'info',
  // Chain multiple formatters for timestamps, stack traces, variable interpolation, and JSON output
  format: winston.format.combine(
    // Format timestamps using readable YYYY-MM-DD HH:mm:ss representation
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // Capture full error stack traces when Error objects are logged
    winston.format.errors({ stack: true }),
    // Enable printf-style string interpolation (%s, %d, etc.)
    winston.format.splat(),
    // Format log entries as structured JSON objects for ingestion by log collectors
    winston.format.json()
  ),
  // Default metadata key-value pairs appended to every log entry
  defaultMeta: { service: 'assessment-service' },
  // Define destination transports for emitted logs
  transports: [
    // Output logs to the standard console with human-readable colorized formatting
    new winston.transports.Console({
      // Compose console-specific formatting pipeline
      format: winston.format.combine(
        // Colorize log level labels according to severity (info = green, error = red, etc.)
        winston.format.colorize(),
        // Format console log line template: [timestamp] level: message/stack
        winston.format.printf(({ timestamp, level, message, stack }) => {
          // Output formatted string with timestamp, colorized level, and stack or message
          return `[${timestamp}] ${level}: ${stack || message}`;
        })
      ),
    }),
  ],
});

// Export configured Winston logger instance for application-wide logging
module.exports = logger;
