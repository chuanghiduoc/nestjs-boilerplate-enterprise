import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { setupSwagger } from './config/swagger.config';
import type { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app');

  // ============================================
  // Shared runtime configuration (also used by E2E tests)
  // Applies prefix, versioning, security middleware, pipes,
  // interceptors and exception filters.
  // ============================================
  configureApp(app, appConfig);

  // ============================================
  // Swagger Documentation (Section 11)
  // The URI versioning layer prepends "v" to the version value, so the
  // documented base path must mirror that (e.g. version "1" -> /api/v1).
  // ============================================
  if (appConfig?.nodeEnv !== 'production') {
    setupSwagger(app, {
      title: 'NestJS Boilerplate API',
      description: 'Clean Architecture + Modular Monolith API',
      version: '1.0.0',
      basePath: `${appConfig?.apiPrefix ?? 'api'}/v${appConfig?.apiVersion ?? '1'}`,
      enabled: true,
    });
    logger.log(`Swagger documentation available at: /docs`);
  }

  // ============================================
  // Graceful Shutdown (Section 12.2)
  // ============================================
  app.enableShutdownHooks();

  // ============================================
  // Start Server
  // ============================================
  const host = appConfig?.host ?? '0.0.0.0';
  const port = appConfig?.port ?? 3000;

  await app.listen(port, host);

  logger.log(`Application is running on: http://${host}:${port}`);
  logger.log(`API base path: /${appConfig?.apiPrefix ?? 'api'}/v${appConfig?.apiVersion ?? '1'}`);
  logger.log(`Environment: ${appConfig?.nodeEnv}`);
}

void bootstrap();
