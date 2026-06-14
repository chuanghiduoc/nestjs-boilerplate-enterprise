import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configLoaders } from './config';
import { CorrelationIdMiddleware } from './shared/middleware';
import { CacheInterceptor } from './shared/interceptors';

// Core Modules (Section 3.1)
import { LoggerModule } from './infrastructure/logger';
import { CacheModule } from './infrastructure/cache';
import { EventBusModule } from './infrastructure/messaging';
import { createDatabaseModule } from './infrastructure/persistence';
import { ShutdownModule } from './infrastructure/shutdown';
import { SecurityModule } from './infrastructure/security';
import { ResilienceModule } from './infrastructure/resilience';
import { MetricsModule } from './infrastructure/metrics';
import { StorageModule } from './infrastructure/storage';
import { EmailModule } from './infrastructure/email';
import { JobsModule } from './infrastructure/jobs';
import { WebSocketModule } from './infrastructure/websocket';
import { I18nModule } from './infrastructure/i18n';
import { GraphQLModule } from './infrastructure/graphql';

// Feature Modules (Section 3.2)
import { AuthModule } from './modules/auth';
import { UserModule } from './modules/user';
import { RoleModule } from './modules/role';
import { TenantModule } from './modules/tenant';
import { HealthModule } from './modules/health';
import { FileModule } from './modules/file';
import { AuditModule } from './modules/audit';

/**
 * Root Application Module
 *
 * Following Section 3 - Module Structure
 *
 * Global modules (Section 3.1):
 * - ConfigModule: Environment configuration
 * - LoggerModule: Structured logging
 * - CacheModule: Caching strategy
 * - EventBusModule: Domain event dispatching
 * - DatabaseModule: Database connection
 * - SecurityModule: Rate limiting & security
 * - ResilienceModule: Circuit breaker, retry, timeout
 * - MetricsModule: Prometheus metrics & OpenTelemetry tracing
 * - StorageModule: File storage (Local/S3)
 * - EmailModule: SMTP email delivery with templates
 * - JobsModule: Background jobs (Bull queue) and scheduled tasks
 * - WebSocketModule: Real-time communication and notifications
 * - I18nModule: Internationalization and translations
 * - GraphQLModule: GraphQL API with Apollo Server
 *
 * Feature modules (Section 3.2):
 * - AuthModule: Authentication & authorization
 * - UserModule: User management
 * - RoleModule: Role-based access control
 * - TenantModule: Multi-tenancy
 * - HealthModule: Health checks
 * - FileModule: File upload/download
 * - AuditModule: Audit logging for compliance
 */
@Module({
  imports: [
    // ============================================
    // Global Configuration Module
    // ============================================
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      cache: true,
    }),

    // ============================================
    // Core Modules (Section 3.1)
    // ============================================
    LoggerModule,
    CacheModule.forRoot(),
    EventBusModule,
    ShutdownModule,
    SecurityModule,
    ResilienceModule,
    MetricsModule,
    StorageModule.forRoot(),
    EmailModule,
    JobsModule,
    WebSocketModule,
    I18nModule,
    GraphQLModule,

    // Database Module - Auto-switches based on DB_TYPE env variable
    // Supports: postgres, mysql, sqlite (TypeORM) | mongodb (Mongoose)
    createDatabaseModule(),

    // ============================================
    // Feature Modules (Section 3.2)
    // ============================================
    HealthModule,
    AuthModule,
    UserModule,
    RoleModule,
    TenantModule,
    FileModule,
    AuditModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Cache Interceptor - handles @Cacheable and @CacheEvict decorators
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware (Section 4.1)
   *
   * Order:
   * 1. Correlation ID (first - adds request ID)
   * 2. Helmet (security headers - handled in main.ts)
   * 3. Compression (when added)
   */
  configure(consumer: MiddlewareConsumer): void {
    // Express v5 (NestJS 11) requires a named wildcard to match all routes.
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}');
  }
}
