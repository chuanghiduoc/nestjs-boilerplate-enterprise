import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationQueueService } from './notification-queue.service';
import { NOTIFICATION_QUEUE } from './queue.constants';

/**
 * Notification Queue Module
 *
 * Handles asynchronous notification delivery.
 *
 * Job Types:
 * - push: Push notifications (mobile/web)
 * - webhook: Webhook deliveries
 * - sms: SMS notifications
 * - in-app: In-app notifications
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  providers: [NotificationQueueService],
  exports: [BullModule, NotificationQueueService],
})
export class NotificationQueueModule {}
