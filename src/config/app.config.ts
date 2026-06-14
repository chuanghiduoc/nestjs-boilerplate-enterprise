import { registerAs } from '@nestjs/config';

/**
 * Application Configuration
 *
 * Following Section 3.1 - ConfigModule is global
 */
export const appConfig = registerAs('app', () => ({
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  name: process.env.APP_NAME || 'nestjs-boilerplate',
  version: process.env.APP_VERSION || '1.0.0',

  // Server
  host: process.env.APP_HOST || '0.0.0.0',
  port: parseInt(process.env.APP_PORT || '3000', 10),

  // API
  // Numeric version only — URI versioning prepends "v" (e.g. "1" -> /api/v1).
  apiPrefix: process.env.API_PREFIX || 'api',
  apiVersion: process.env.API_VERSION || '1',

  // Security
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Debug
  debug: process.env.APP_DEBUG === 'true',

  // Request limits (Section 12.5)
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
  urlEncodedLimit: process.env.URL_ENCODED_LIMIT || '1mb',
}));

export type AppConfig = ReturnType<typeof appConfig>;
