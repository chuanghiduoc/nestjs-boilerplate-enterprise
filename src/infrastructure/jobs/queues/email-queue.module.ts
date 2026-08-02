import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailQueueService } from './email-queue.service';
import { EMAIL_QUEUE } from './queue.constants';

/**
 * Email Queue Module
 *
 * Handles asynchronous email sending.
 *
 * Job Types:
 * - welcome: Send welcome email to new users
 * - verification: Send email verification link
 * - password-reset: Send password reset link
 * - notification: Send notification emails
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }),
  ],
  providers: [EmailQueueService],
  exports: [BullModule, EmailQueueService],
})
export class EmailQueueModule {}
