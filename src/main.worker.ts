import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  process.title = 'nestjs-worker';
  const logger = new Logger('WorkerBootstrap');
  const context = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  context.enableShutdownHooks();
  logger.log('Background worker is ready and consuming queues');
}

void bootstrap();
