const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 5050,
  NODE_ENV: process.env.NODE_ENV || 'development',
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
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
