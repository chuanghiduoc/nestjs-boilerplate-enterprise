export * from './app.config';
export * from './database.config';
export * from './jwt.config';
export * from './cache.config';
export * from './throttle.config';
export * from './swagger.config';
export * from './configure-app';
export * from './security.config';
export * from './storage.config';
export * from './email.config';
export * from './auth.config';
export * from './queue.config';
export * from './websocket.config';
export * from './i18n.config';

import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { jwtConfig } from './jwt.config';
import { cacheConfig } from './cache.config';
import { throttleConfig } from './throttle.config';
import { securityConfig } from './security.config';
import { storageConfig } from './storage.config';
import { emailConfig } from './email.config';
import { authConfig } from './auth.config';
import { queueConfig } from './queue.config';
import { websocketConfig } from './websocket.config';
import { i18nConfig } from './i18n.config';

/**
 * All configuration loaders
 * Used in ConfigModule.forRoot({ load: [...] })
 */
export const configLoaders = [
  appConfig,
  databaseConfig,
  jwtConfig,
  cacheConfig,
  throttleConfig,
  securityConfig,
  storageConfig,
  emailConfig,
  authConfig,
  queueConfig,
  websocketConfig,
  i18nConfig,
];
