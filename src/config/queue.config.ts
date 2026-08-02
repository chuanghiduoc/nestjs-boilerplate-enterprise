import { registerAs } from '@nestjs/config';

function parseWebhookTimeout(value: string | undefined): number {
  const parsed = Number(value ?? 10000);
  return Number.isSafeInteger(parsed) && parsed >= 1000 && parsed <= 120000 ? parsed : 10000;
}

/**
 * Queue Configuration
 *
 * Environment variables:
 * - REDIS_HOST: Redis host for Bull queue
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 * - QUEUE_PREFIX: Prefix for queue names (default: bull)
 * - QUEUE_DEFAULT_JOB_OPTIONS_ATTEMPTS: Default job retry attempts (default: 3)
 * - QUEUE_DEFAULT_JOB_OPTIONS_BACKOFF: Backoff delay in ms (default: 5000)
 * - QUEUE_REALTIME_CHANNEL: Redis pub/sub channel for worker-to-API events
 */
export const queueConfig = registerAs('queue', () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  prefix: process.env.QUEUE_PREFIX || 'bull',
  realtimeChannel: process.env.QUEUE_REALTIME_CHANNEL || 'app:realtime',
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_DEFAULT_JOB_OPTIONS_ATTEMPTS || '3', 10),
    backoff: {
      type: 'exponential' as const,
      delay: parseInt(process.env.QUEUE_DEFAULT_JOB_OPTIONS_BACKOFF || '5000', 10),
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
  webhook: {
    // Empty means public hosts are allowed; private/link-local destinations are always rejected.
    allowedHosts: (process.env.WEBHOOK_ALLOWED_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
    timeoutMs: parseWebhookTimeout(process.env.WEBHOOK_TIMEOUT_MS),
  },
}));

export type QueueConfig = ReturnType<typeof queueConfig>;
