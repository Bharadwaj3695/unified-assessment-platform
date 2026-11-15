// Import Mongoose ODM library for establishing and managing MongoDB database connections
const mongoose = require('mongoose');
const https = require('https');
// Import platform environment variables containing configured database connection URI and runtime environment
const env = require('./env');

// Reference to in-memory MongoDB instance when fallback testing mode is activated
let mongoMemoryServer = null;

// Helper to quickly detect current public IP for actionable diagnostics
const fetchPublicIp = async () => {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', { timeout: 2500 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data.trim() || null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
};

// Asynchronous connection manager establishing database connection adhering to strict persistence policy:
// 1. Isolated test mode (NODE_ENV === 'test') uses MongoMemoryServer for hermetic test execution.
// 2. In development and production, connects directly to authoritative MONGODB_URI (e.g. Atlas).
// 3. Never silently falls back to ephemeral in-memory storage when remote database connection fails.
// 4. Provides clear, actionable diagnostics distinguishing network, DNS, TLS, whitelist, and auth failures.
const connectDB = async () => {
  // If already connected, reuse active connection
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Hermetic test mode: strictly isolated to automated test runs
  const isTestMode = env.NODE_ENV === 'test';

  if (isTestMode) {
    try {
      if (!mongoMemoryServer) {
        console.log('[Database] Starting local MongoDB instance for isolated testing...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create({
          instance: {
            args: ['--setParameter', 'diagnosticDataCollectionEnabled=false'],
          },
        });
      }
      const uri = mongoMemoryServer.getUri();
      await mongoose.connect(uri);
      console.log(`[Database] Local isolated MongoDB instance connected: ${uri}`);
      return;
    } catch (innerErr) {
      console.error('[Database] Failed to start local MongoDB instance for testing:', innerErr.message);
      throw innerErr;
    }
  }

  // Authoritative database connection in development and production
  const cleanUri = (env.MONGODB_URI || '').replace(/^["']|["']$/g, '');
  const isAtlas = cleanUri.includes('mongodb+srv') || cleanUri.includes('mongodb.net');

  try {
    const conn = await mongoose.connect(cleanUri, {
      dbName: 'unified_assessment',
      serverSelectionTimeoutMS: 5000,
    });
    // Log successful authoritative MongoDB cluster connection host and database
    console.log(`[Database] MongoDB connected successfully to ${isAtlas ? 'Atlas cluster' : 'database'}: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    // Inspect server errors in reason map for TLS alert / whitelist details
    let serverErrorsDetail = '';
    if (err.reason && err.reason.servers) {
      for (const [host, info] of err.reason.servers.entries()) {
        if (info.error) {
          serverErrorsDetail += ` ${host}: ${info.error.message};`;
        }
      }
    }

    const fullErrMsg = `${err.message || ''} ${serverErrorsDetail}`;
    const isTlsAlertOrWhitelist =
      fullErrMsg.includes('SSL alert') ||
      fullErrMsg.includes('tlsv1 alert') ||
      fullErrMsg.includes("IP that isn't whitelisted") ||
      fullErrMsg.includes('SSL routines');

    const isDnsError =
      fullErrMsg.includes('ENOTFOUND') ||
      fullErrMsg.includes('querySrv') ||
      fullErrMsg.includes('EAI_AGAIN');

    const isAuthError =
      err.name === 'MongoServerError' &&
      (err.code === 8000 || /authentication failed|bad auth/i.test(fullErrMsg));

    const isTimeout =
      fullErrMsg.includes('ETIMEDOUT') ||
      fullErrMsg.includes('timed out');

    console.error(`[Database] FATAL: Could not connect to primary MongoDB URI.`);
    console.error(`[Database] Error [${err.name}]: ${err.message}`);

    if (isAtlas && (isTlsAlertOrWhitelist || err.name === 'MongooseServerSelectionError')) {
      const publicIp = await fetchPublicIp();
      console.error(`[Database] DIAGNOSTIC: MongoDB Atlas rejected the connection (TLS alert / IP Access List restriction).`);
      if (publicIp) {
        console.error(`[Database] Detected Public IP: ${publicIp}`);
        console.error(`[Database] ACTION REQUIRED: Add "${publicIp}/32" to your MongoDB Atlas Network Access IP Access List:`);
      } else {
        console.error(`[Database] ACTION REQUIRED: Add your current public IP address to your MongoDB Atlas Network Access IP Access List:`);
      }
      console.error(`[Database] -> Visit: https://cloud.mongodb.com -> Network Access -> Add IP Address`);
    } else if (isDnsError) {
      console.error(`[Database] DIAGNOSTIC: DNS resolution failed for MongoDB Atlas cluster host.`);
      console.error(`[Database] ACTION REQUIRED: Verify the hostname in MONGODB_URI and check system DNS connectivity.`);
    } else if (isAuthError) {
      console.error(`[Database] DIAGNOSTIC: MongoDB authentication failed (invalid username or password).`);
      console.error(`[Database] ACTION REQUIRED: Check credentials and authSource in backend/.env.`);
    } else if (isTimeout) {
      console.error(`[Database] DIAGNOSTIC: Connection timed out attempting to reach MongoDB Atlas cluster.`);
      console.error(`[Database] ACTION REQUIRED: Verify cluster is active and no outbound firewall blocks port 27017.`);
    }

    console.error(`[Database] Strict Database Policy: Silent fallback to ephemeral in-memory storage is disabled in development/production to guarantee data integrity.`);

    // Re-throw connection error so server process and checkDbReady middleware correctly detect disconnected state (HTTP 503)
    throw err;
  }
};

// Graceful disconnection handler ensuring all connection pools and memory daemons are cleanly released
const disconnectDB = async () => {
  // Close all active Mongoose database connections and clean up sockets
  await mongoose.disconnect();
  // Check if an ephemeral in-memory server was launched during this process lifecycle
  if (mongoMemoryServer) {
    // Terminate the in-memory MongoDB server process and delete temporary database files
    await mongoMemoryServer.stop({ doCleanup: true, force: true });
    mongoMemoryServer = null;
  }
};

// Export connection management functions for application startup and testing teardown
module.exports = {
  connectDB,
  disconnectDB,
};
