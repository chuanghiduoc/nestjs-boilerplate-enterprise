import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
  ValidationExceptionFilter,
} from '../shared/filters';
import {
  TransformResponseInterceptor,
  TimeoutInterceptor,
  ResponseTimeInterceptor,
} from '../shared/interceptors';
import { TrimStringPipe, SanitizePipe } from '../shared/pipes';
import type { AppConfig } from './app.config';

/**
 * Apply the runtime configuration shared by the production bootstrap and the
 * E2E test harness.
 *
 * Keeping this in one place guarantees that tests exercise the exact same
 * pipeline (versioning, prefix, security middleware, pipes, interceptors and
 * exception filters) as the running application — preventing the test
 * environment from masking production-only behaviour.
 */
export function configureApp(app: INestApplication, appConfig?: AppConfig): void {
  // ============================================
  // API Prefix & URI Versioning
  // URI versioning prepends "v" to the version value, so a version of "1"
  // produces routes under /<prefix>/v1.
  // ============================================
  app.setGlobalPrefix(appConfig?.apiPrefix ?? 'api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: appConfig?.apiVersion ?? '1',
  });

  // ============================================
  // Security Headers
  // ============================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      noSniff: true,
      originAgentCluster: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // ============================================
  // Response Compression
  // ============================================
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024,
      level: 6,
    }),
  );

  // ============================================
  // Request Size Limits
  // ============================================
  app.use(json({ limit: appConfig?.jsonBodyLimit ?? '1mb' }));
  app.use(urlencoded({ extended: true, limit: appConfig?.urlEncodedLimit ?? '1mb' }));

  // ============================================
  // CORS Configuration
  // ============================================
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = appConfig?.corsOrigins ?? ['http://localhost:3000'];
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Tenant-Id',
      'Accept-Language',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400,
  });

  // ============================================
  // Global Pipes
  // Order: TrimString -> Sanitize -> Validation
  // ============================================
  app.useGlobalPipes(
    new TrimStringPipe(),
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      stopAtFirstError: false,
      errorHttpStatusCode: 400,
    }),
  );

  // ============================================
  // Global Interceptors
  // ============================================
  app.useGlobalInterceptors(
    new ResponseTimeInterceptor(),
    new TimeoutInterceptor(),
    new TransformResponseInterceptor(),
  );

  // ============================================
  // Global Filters (more specific first)
  // ============================================
  app.useGlobalFilters(
    new ValidationExceptionFilter(),
    new DomainExceptionFilter(),
    new AllExceptionsFilter(),
  );
}
