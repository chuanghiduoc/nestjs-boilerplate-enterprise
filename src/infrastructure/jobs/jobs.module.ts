import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { QueueConfig } from '@config/queue.config';

// Queues
import { EmailQueueModule } from './queues/email-queue.module';
import { NotificationQueueModule } from './queues/notification-queue.module';
import { CleanupQueueModule } from './queues/cleanup-queue.module';

/**
 * Jobs Module
 *
 * Provides queue clients and job producers.
 *
 * This module is safe to load in the API runtime: processors and cron
 * schedulers live in JobProcessorsModule and JobSchedulersModule so an API
 * replica never consumes or schedules background work.
 *
 * Features:
 * - Bull queue for async job processing
 * - Redis-backed job persistence
 * - Job retry with exponential backoff
 *
 * Queue Types:
 * - email: Email sending (welcome, verification, reset)
 * - notification: Push notifications, webhooks
 * - cleanup: Data cleanup, maintenance tasks
 */
@Module({
  imports: [
    // Bull Queue Configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const queueConfig = configService.get<QueueConfig>('queue');
        return {
          redis: {
            host: queueConfig?.redis.host || 'localhost',
            port: queueConfig?.redis.port || 6379,
            password: queueConfig?.redis.password,
            db: queueConfig?.redis.db || 0,
          },
          prefix: queueConfig?.prefix || 'bull',
          defaultJobOptions: queueConfig?.defaultJobOptions || {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        };
      },
      inject: [ConfigService],
    }),

    // Queue Modules
    EmailQueueModule,
    NotificationQueueModule,
    CleanupQueueModule,
  ],
  exports: [EmailQueueModule, NotificationQueueModule, CleanupQueueModule],
})
export class JobsModule {}
