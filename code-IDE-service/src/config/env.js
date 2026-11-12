const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Attempt to load .env from dedicated service root first, falling back to backend/.env if present
const localEnvPath = path.resolve(__dirname, '../../.env');
const backendEnvPath = path.resolve(__dirname, '../../../backend/.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5050,
  NODE_ENV: process.env.NODE_ENV || 'development',
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || process.env.EXECUTION_SERVICE_API_KEY || 'dev_uap_exec_internal_secret_key_32bytes!!',
  DOCKER_SOCKET_PATH: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
  DEFAULT_TIMEOUT_MS: parseInt(process.env.DEFAULT_TIMEOUT_MS, 10) || 2000,
  MAX_TIMEOUT_MS: parseInt(process.env.MAX_TIMEOUT_MS, 10) || 10000,
  DEFAULT_MEMORY_MB: parseInt(process.env.DEFAULT_MEMORY_MB, 10) || 256,
  MAX_MEMORY_MB: parseInt(process.env.MAX_MEMORY_MB, 10) || 512,
  DEFAULT_CPUS: parseFloat(process.env.DEFAULT_CPUS) || 1.0,
  MAX_OUTPUT_BYTES: parseInt(process.env.MAX_OUTPUT_BYTES, 10) || 65536, // 64 KB
  MAX_PIDS: parseInt(process.env.MAX_PIDS, 10) || 64,
  MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 10,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Redis Queue Configuration (Asynchronous Queue Decoupling)
  REDIS_HOST: process.env.REDIS_HOST || 'uap-redis',
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  USE_REDIS_QUEUE: process.env.USE_REDIS_QUEUE === 'true',

  // Ephemeral Runner Images
  RUNNER_IMAGE_PYTHON: process.env.RUNNER_IMAGE_PYTHON || 'uap-runner-python:3.11-alpine',
  RUNNER_IMAGE_JAVASCRIPT: process.env.RUNNER_IMAGE_JAVASCRIPT || 'uap-runner-node:20-alpine',
  RUNNER_IMAGE_SQLITE: process.env.RUNNER_IMAGE_SQLITE || 'uap-runner-sqlite:3.45-alpine',

  // SQL Engine Configuration (Isolated databases for student queries)
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'uap-postgres-engine',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
  POSTGRES_USER: process.env.POSTGRES_USER || 'uap_sql_admin',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB || 'uap_sql_sandbox',

  MYSQL_HOST: process.env.MYSQL_HOST || 'uap-mysql-engine',
  MYSQL_PORT: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  MYSQL_USER: process.env.MYSQL_USER || 'uap_sql_admin',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  MYSQL_DB: process.env.MYSQL_DB || 'uap_sql_sandbox',
};
