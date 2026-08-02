import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configLoaders } from './config';
import { LoggerModule } from './infrastructure/logger';
import { JobsModule, JobSchedulersModule } from './infrastructure/jobs';
import { ShutdownModule } from './infrastructure/shutdown';

/** Standalone non-HTTP application that enqueues scheduled maintenance jobs. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      cache: true,
    }),
    LoggerModule,
    ShutdownModule,
    JobsModule,
    JobSchedulersModule,
  ],
})
export class SchedulerModule {}
