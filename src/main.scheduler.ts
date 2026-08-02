import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SchedulerModule } from './scheduler.module';

async function bootstrap(): Promise<void> {
  process.title = 'nestjs-scheduler';
  const logger = new Logger('SchedulerBootstrap');
  const context = await NestFactory.createApplicationContext(SchedulerModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  context.enableShutdownHooks();
  logger.log('Scheduler is ready; cron jobs will only run in this process');
}

void bootstrap();
