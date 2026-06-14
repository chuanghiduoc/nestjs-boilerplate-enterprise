import { type TestingModule, Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp, type AppConfig } from '../../src/config';

/**
 * Test Application Factory
 *
 * Creates a NestJS application configured identically to production so that
 * E2E tests exercise the real request pipeline (versioning, prefix, global
 * pipes, interceptors and exception filters).
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app');

  // Apply the exact same configuration as the production bootstrap.
  configureApp(app, appConfig);

  await app.init();

  return app;
}

/**
 * Close test application
 */
export async function closeTestApp(app: INestApplication | undefined): Promise<void> {
  if (app) {
    await app.close();
  }
}
