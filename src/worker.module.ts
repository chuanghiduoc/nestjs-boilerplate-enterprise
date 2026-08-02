import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configLoaders } from './config';
import { LoggerModule } from './infrastructure/logger';
import { CacheModule } from './infrastructure/cache';
import { EmailModule } from './infrastructure/email';
import { JobsModule, JobProcessorsModule } from './infrastructure/jobs';
import { createDatabaseModule } from './infrastructure/persistence';
import { ShutdownModule } from './infrastructure/shutdown';

/** Standalone non-HTTP application that consumes Bull jobs. */
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
    CacheModule.forRoot(),
    ShutdownModule,
    EmailModule,
    createDatabaseModule(),
    JobsModule,
    JobProcessorsModule,
  ],
})
export class WorkerModule {}
