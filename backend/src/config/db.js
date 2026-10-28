// Import Mongoose ODM library for establishing and managing MongoDB database connections
const mongoose = require('mongoose');
// Import platform environment variables containing configured database connection URI and runtime environment
const env = require('./env');

// Reference to in-memory MongoDB instance when fallback testing mode is activated
let mongoMemoryServer = null;

// Asynchronous connection manager establishing database connection with automatic fallback in non-production environments
const connectDB = async () => {
  // If already connected, reuse active connection
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // In test mode or when in-memory database is explicitly requested with an unreachable remote URI, start local instance directly
  const useInMemoryDirectly = env.NODE_ENV === 'test' || (env.ALLOW_IN_MEMORY_DB === 'true' && env.MONGODB_URI.includes('mongodb+srv'));

  if (useInMemoryDirectly) {
    try {
      if (!mongoMemoryServer) {
        console.log('[Database] Starting local MongoDB instance for seamless testing/development...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create({
          instance: {
            args: ['--setParameter', 'diagnosticDataCollectionEnabled=false'],
          },
        });
      }
      const uri = mongoMemoryServer.getUri();
      await mongoose.connect(uri);
      console.log(`[Database] Local MongoDB instance connected: ${uri}`);
      return;
    } catch (innerErr) {
      console.error('[Database] Failed to start local MongoDB instance:', innerErr.message);
      throw innerErr;
    }
  }

  // Attempt connection to the primary configured MongoDB database instance
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
    });
    // Log successful primary MongoDB cluster connection host address
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}`);
  // Catch connection errors if primary database is unreachable or access is blocked
  } catch (err) {
    // Log warning notice describing primary MongoDB connection failure
    console.warn(`[Database] Could not connect to primary MongoDB URI (${err.message}).`);
    
    // In local development / test without active mongod daemon, initialize embedded MongoDB engine
    if (env.NODE_ENV !== 'production' || env.ALLOW_IN_MEMORY_DB === 'true') {
      // Begin fallback initialization of in-memory MongoDB server
      try {
        // Notify developer that embedded MongoDB memory instance is spinning up
        console.log('[Database] Starting local MongoDB instance for seamless development/testing...');
        // Dynamically require mongodb-memory-server so it is not bundled or loaded in production
        const { MongoMemoryServer } = require('mongodb-memory-server');
        // Instantiate the ephemeral in-memory MongoDB daemon with ftdc disabled to prevent signal 6 crash on WSL2/Linux
        mongoMemoryServer = await MongoMemoryServer.create({
          instance: {
            args: ['--setParameter', 'diagnosticDataCollectionEnabled=false'],
          },
        });
        // Retrieve the generated dynamic connection URI for the memory database
        const uri = mongoMemoryServer.getUri();
        // Cleanly disconnect failed connection attempt before connecting to in-memory instance
        await mongoose.disconnect();
        // Connect Mongoose to the newly spawned in-memory MongoDB instance
        await mongoose.connect(uri);
        // Log confirmation of local database connectivity for zero-configuration development
        console.log(`[Database] Local MongoDB instance connected: ${uri}`);
      // Handle fatal failure when spawning embedded database
      } catch (innerErr) {
        // Log detailed failure error when starting local memory instance
        console.error('[Database] Failed to start local MongoDB instance:', innerErr.message);
        // Re-throw original primary connection error to fail server boot
        throw err;
      }
    // In production environments, database connection failures must fail fast and never use ephemeral storage
    } else {
      // Re-throw the connection error so the container or process manager can restart or alert ops
      throw err;
    }
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
