import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CleanupQueueService } from './cleanup-queue.service';
import { CLEANUP_QUEUE } from './queue.constants';

/**
 * Cleanup Queue Module
 *
 * Handles data cleanup and maintenance tasks.
 *
 * Job Types:
 * - expired-tokens: Clean expired refresh tokens
 * - expired-sessions: Clean expired sessions
 * - orphaned-files: Clean orphaned uploaded files
 * - audit-logs: Archive old audit logs
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: CLEANUP_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 60000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    }),
  ],
  providers: [CleanupQueueService],
  exports: [BullModule, CleanupQueueService],
})
export class CleanupQueueModule {}
