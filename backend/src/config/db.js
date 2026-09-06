const mongoose = require('mongoose');
const env = require('./env');

let mongoMemoryServer = null;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}`);
  } catch (err) {
    console.warn(`[Database] Could not connect to primary MongoDB URI (${err.message}).`);
    
    // In local development / test without active mongod daemon, initialize embedded MongoDB engine
    if (env.NODE_ENV !== 'production') {
      try {
        console.log('[Database] Starting local MongoDB instance for seamless development/testing...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create();
        const uri = mongoMemoryServer.getUri();
        await mongoose.connect(uri);
        console.log(`[Database] Local MongoDB instance connected: ${uri}`);
      } catch (innerErr) {
        console.error('[Database] Failed to start local MongoDB instance:', innerErr.message);
        throw err;
      }
    } else {
      throw err;
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
