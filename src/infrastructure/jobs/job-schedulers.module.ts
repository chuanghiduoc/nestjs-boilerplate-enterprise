import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupQueueModule } from './queues/cleanup-queue.module';
import { TokenCleanupScheduler } from './schedulers/token-cleanup.scheduler';
import { SessionCleanupScheduler } from './schedulers/session-cleanup.scheduler';
import { ReportScheduler } from './schedulers/report.scheduler';

/** Cron producers loaded only by the singleton scheduler runtime. */
@Module({
  imports: [ScheduleModule.forRoot(), CleanupQueueModule],
  providers: [TokenCleanupScheduler, SessionCleanupScheduler, ReportScheduler],
})
export class JobSchedulersModule {}
