const Redis = require('ioredis');
const crypto = require('crypto');
const EventEmitter = require('events');
const env = require('../config/env');
const logger = require('../utils/logger');

class RedisQueueService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
    this.queueKey = 'uap:execution:jobs';
    this.resultPrefix = 'uap:execution:result:';
    this.channelPrefix = 'uap:execution:done:';
    this.waitingRequests = new Map(); // jobId -> { resolve, reject, timer }

    if (env.USE_REDIS_QUEUE) {
      this.initRedis();
    }
  }

  /**
   * Initialize Redis Client and Subscriber
   */
  initRedis() {
    try {
      const redisOpts = {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 100, 2000),
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
      };

      this.client = new Redis(redisOpts);
      this.subscriber = new Redis(redisOpts);

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('Redis Queue Client ready.', { host: env.REDIS_HOST, port: env.REDIS_PORT });
      });

      this.client.on('error', (err) => {
        logger.warn(`Redis Queue Client connection error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      this.subscriber.on('message', (channel, message) => {
        if (channel.startsWith(this.channelPrefix)) {
          const jobId = channel.slice(this.channelPrefix.length);
          this.handleResultDelivery(jobId, message);
        }
      });
    } catch (err) {
      this.isConnected = false;
      logger.warn(`Redis initialization failed: ${err.message}`);
    }
  }

  /**
   * Resolve waiting HTTP caller when job result is received
   */
  handleResultDelivery(jobId, rawMessage) {
    const waiter = this.waitingRequests.get(jobId);
    if (!waiter) return;

    clearTimeout(waiter.timer);
    this.waitingRequests.delete(jobId);

    try {
      const parsed = JSON.parse(rawMessage);
      waiter.resolve(parsed);
    } catch (err) {
      waiter.reject(new Error(`Failed to parse job result: ${err.message}`));
    }
  }

  /**
   * Submit job to queue and await result with safety timeout
   */
  async submitAndAwaitJob(jobPayload, timeoutMs = env.DEFAULT_TIMEOUT_MS) {
    const jobId = jobPayload.jobId || `uap-job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    jobPayload.jobId = jobId;

    // If Redis is active and connected, dispatch to Redis queue
    if (this.isConnected && this.client && this.subscriber) {
      return new Promise(async (resolve, reject) => {
        const safetyTimeoutMs = timeoutMs + 3000; // Allow 3s buffer for queue dispatch and container cleanup

        const timer = setTimeout(() => {
          this.waitingRequests.delete(jobId);
          try {
            this.subscriber.unsubscribe(`${this.channelPrefix}${jobId}`);
          } catch (_) {}
          resolve({
            jobId,
            verdict: 'TIME_LIMIT_EXCEEDED',
            exitCode: 124,
            stdout: '',
            stderr: `Execution terminated: job exceeded wall-clock limit of ${timeoutMs}ms.`,
            outputTruncated: false,
            executionTimeMs: timeoutMs,
            memoryUsedBytes: 0,
            mode: 'REDIS_WORKER',
          });
        }, safetyTimeoutMs);

        this.waitingRequests.set(jobId, { resolve, reject, timer });

        try {
          // Subscribe to job completion channel
          await this.subscriber.subscribe(`${this.channelPrefix}${jobId}`);
          // Push job payload to worker queue
          await this.client.rpush(this.queueKey, JSON.stringify(jobPayload));
        } catch (err) {
          clearTimeout(timer);
          this.waitingRequests.delete(jobId);
          logger.warn(`Failed to push job to Redis queue: ${err.message}. Falling back.`);
          reject(err);
        }
      });
    }

    // Hermetic fallback: if Redis is inactive or in unit tests, process synchronously via in-process runner
    const jobQueue = require('../services/jobQueue.service');
    return await jobQueue.processJobDirectly(jobPayload);
  }

  /**
   * Publish job result from worker back to Redis
   */
  async publishResult(jobId, result) {
    if (!this.client) return;
    const serialized = JSON.stringify(result);
    // Store in key with 60-second TTL
    await this.client.setex(`${this.resultPrefix}${jobId}`, 60, serialized);
    // Publish notification to subscriber
    await this.client.publish(`${this.channelPrefix}${jobId}`, serialized);
  }

  /**
   * Pop next job from Redis queue (Worker Consumer)
   */
  async popNextJob(timeoutSeconds = 2) {
    if (!this.client || !this.isConnected) {
      await new Promise((r) => setTimeout(r, 1000));
      return null;
    }
    const res = await this.client.blpop(this.queueKey, timeoutSeconds);
    if (!res || !res[1]) return null;
    return JSON.parse(res[1]);
  }

  /**
   * Close connections gracefully
   */
  async close() {
    if (this.subscriber) await this.subscriber.quit().catch(() => {});
    if (this.client) await this.client.quit().catch(() => {});
    this.isConnected = false;
  }
}

module.exports = new RedisQueueService();
