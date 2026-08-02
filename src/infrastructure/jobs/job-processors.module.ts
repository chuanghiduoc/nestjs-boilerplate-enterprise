import { Module } from '@nestjs/common';
import { EmailQueueModule } from './queues/email-queue.module';
import { NotificationQueueModule } from './queues/notification-queue.module';
import { CleanupQueueModule } from './queues/cleanup-queue.module';
import { EmailProcessor } from './processors/email.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { RealtimePublisherService } from './realtime/realtime-publisher.service';

/** Queue consumers loaded only by the worker runtime. */
@Module({
  imports: [EmailQueueModule, NotificationQueueModule, CleanupQueueModule],
  providers: [EmailProcessor, NotificationProcessor, CleanupProcessor, RealtimePublisherService],
})
export class JobProcessorsModule {}
