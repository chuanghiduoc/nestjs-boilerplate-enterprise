#!/usr/bin/env node
/**
 * NestJS Boilerplate Setup Script
 *
 * Interactive CLI to customize the boilerplate by removing unused features.
 *
 * Usage: pnpm setup
 */

import inquirer from 'inquirer';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}→${colors.reset} ${msg}`),
};

// Feature configurations
const FEATURES = {
  database: {
    typeorm: {
      name: 'TypeORM (PostgreSQL)',
      paths: ['src/infrastructure/persistence/typeorm'],
      deps: ['typeorm', '@nestjs/typeorm', 'pg'],
    },
    prisma: {
      name: 'Prisma',
      paths: ['src/infrastructure/persistence/prisma'],
      deps: ['@prisma/client', 'prisma'],
    },
    mongoose: {
      name: 'Mongoose (MongoDB)',
      paths: ['src/infrastructure/persistence/mongoose'],
      deps: ['mongoose', '@nestjs/mongoose'],
    },
  },
  auth: {
    google: {
      name: 'Google OAuth',
      paths: ['src/modules/auth/infrastructure/strategies/google.strategy.ts'],
      deps: ['passport-google-oauth20', '@types/passport-google-oauth20'],
    },
    facebook: {
      name: 'Facebook OAuth',
      paths: ['src/modules/auth/infrastructure/strategies/facebook.strategy.ts'],
      deps: ['passport-facebook', '@types/passport-facebook'],
    },
    apple: {
      name: 'Apple OAuth',
      paths: ['src/modules/auth/infrastructure/strategies/apple.strategy.ts'],
      deps: ['passport-apple'],
    },
  },
  optional: {
    graphql: {
      name: 'GraphQL API',
      paths: ['src/infrastructure/graphql', 'src/modules/user/presentation/graphql'],
      deps: ['@nestjs/graphql', '@nestjs/apollo', '@apollo/server', 'graphql'],
      importPattern: /import \{ GraphQLModule \} from '\.\/infrastructure\/graphql';\n/,
      modulePattern: /\s*GraphQLModule,?\n?/g,
    },
    websocket: {
      name: 'WebSocket (Socket.io)',
      paths: ['src/infrastructure/websocket'],
      deps: ['@nestjs/websockets', '@nestjs/platform-socket.io', 'socket.io'],
      importPattern: /import \{ WebSocketModule \} from '\.\/infrastructure\/websocket';\n/,
      modulePattern: /\s*WebSocketModule,?\n?/g,
    },
    jobs: {
      name: 'Background Jobs (Bull)',
      paths: ['src/infrastructure/jobs'],
      deps: ['@nestjs/bull', 'bull', '@types/bull'],
      importPattern: /import \{ JobsModule \} from '\.\/infrastructure\/jobs';\n/,
      modulePattern: /\s*JobsModule,?\n?/g,
    },
    i18n: {
      name: 'Internationalization (i18n)',
      paths: ['src/infrastructure/i18n'],
      deps: ['nestjs-i18n'],
      importPattern: /import \{ I18nModule \} from '\.\/infrastructure\/i18n';\n/,
      modulePattern: /\s*I18nModule,?\n?/g,
    },
    metrics: {
      name: 'Metrics & Tracing',
      paths: ['src/infrastructure/metrics'],
      deps: [
        'prom-client',
        '@opentelemetry/api',
        '@opentelemetry/sdk-node',
        '@opentelemetry/auto-instrumentations-node',
        '@opentelemetry/exporter-prometheus',
      ],
      importPattern: /import \{ MetricsModule \} from '\.\/infrastructure\/metrics';\n/,
      modulePattern: /\s*MetricsModule,?\n?/g,
    },
    email: {
      name: 'Email (Nodemailer)',
      paths: ['src/infrastructure/email'],
      deps: ['nodemailer', '@types/nodemailer', 'handlebars'],
      importPattern: /import \{ EmailModule \} from '\.\/infrastructure\/email';\n/,
      modulePattern: /\s*EmailModule,?\n?/g,
    },
    storage: {
      name: 'File Storage (S3/Local)',
      paths: ['src/infrastructure/storage', 'src/modules/file'],
      deps: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', 'multer', '@types/multer'],
      importPattern: /import \{ StorageModule \} from '\.\/infrastructure\/storage';\nimport \{ FileModule \} from '\.\/modules\/file';\n/,
      modulePattern: /\s*StorageModule\.forRoot\(\),?\n?/g,
      modulePattern2: /\s*FileModule,?\n?/g,
    },
    audit: {
      name: 'Audit Logging',
      paths: ['src/modules/audit'],
      deps: [],
      importPattern: /import \{ AuditModule \} from '\.\/modules\/audit';\n/,
      modulePattern: /\s*AuditModule\.forRoot\(\),?\n?/g,
    },
  },
};

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           NestJS Boilerplate Setup Wizard                    ║');
  console.log('║   Customize your project by removing unused features         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Step 1: Database selection
  log.step('Database Configuration');
  const { database } = await inquirer.prompt([
    {
      type: 'list',
      name: 'database',
      message: 'Which database ORM do you want to use?',
      choices: [
        { name: 'TypeORM (PostgreSQL) - Recommended', value: 'typeorm' },
        { name: 'Prisma (PostgreSQL/MySQL/SQLite)', value: 'prisma' },
        { name: 'Mongoose (MongoDB)', value: 'mongoose' },
      ],
      default: 'typeorm',
    },
  ]);

  // Step 2: Auth strategies
  log.step('Authentication Strategies');
  const { authStrategies } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'authStrategies',
      message: 'Which OAuth providers do you need? (Space to toggle)',
      choices: [
        { name: 'Google OAuth', value: 'google', checked: true },
        { name: 'Facebook OAuth', value: 'facebook', checked: false },
        { name: 'Apple OAuth', value: 'apple', checked: false },
      ],
    },
  ]);

  // Step 3: Optional features
  log.step('Optional Features');
  const { optionalFeatures } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'optionalFeatures',
      message: 'Which optional features do you need?',
      choices: [
        { name: 'GraphQL API', value: 'graphql', checked: false },
        { name: 'WebSocket (Real-time)', value: 'websocket', checked: false },
        { name: 'Background Jobs (Bull Queue)', value: 'jobs', checked: true },
        { name: 'Internationalization (i18n)', value: 'i18n', checked: false },
        { name: 'Metrics & Tracing', value: 'metrics', checked: false },
        { name: 'Email (SMTP)', value: 'email', checked: true },
        { name: 'File Storage (S3/Local)', value: 'storage', checked: true },
        { name: 'Audit Logging', value: 'audit', checked: false },
      ],
    },
  ]);

  // Build removal lists
  const toRemove = {
    databases: Object.keys(FEATURES.database).filter((k) => k !== database),
    auth: Object.keys(FEATURES.auth).filter((k) => !authStrategies.includes(k)),
    features: Object.keys(FEATURES.optional).filter((k) => !optionalFeatures.includes(k)),
  };

  // Confirmation
  console.log('\n');
  log.info('Configuration:');
  console.log(`  ${colors.green}Keep${colors.reset} Database: ${FEATURES.database[database].name}`);
  console.log(
    `  ${colors.green}Keep${colors.reset} Auth: ${authStrategies.length ? authStrategies.map((a) => FEATURES.auth[a].name).join(', ') : 'JWT only'}`,
  );
  console.log(
    `  ${colors.green}Keep${colors.reset} Features: ${optionalFeatures.length ? optionalFeatures.map((f) => FEATURES.optional[f].name).join(', ') : 'Core only'}`,
  );
  console.log('');
  if (toRemove.databases.length) {
    console.log(
      `  ${colors.red}Remove${colors.reset} Databases: ${toRemove.databases.map((d) => FEATURES.database[d].name).join(', ')}`,
    );
  }
  if (toRemove.auth.length) {
    console.log(
      `  ${colors.red}Remove${colors.reset} Auth: ${toRemove.auth.map((a) => FEATURES.auth[a].name).join(', ')}`,
    );
  }
  if (toRemove.features.length) {
    console.log(
      `  ${colors.red}Remove${colors.reset} Features: ${toRemove.features.map((f) => FEATURES.optional[f].name).join(', ')}`,
    );
  }
  console.log('\n');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with cleanup? This will delete unused files.',
      default: false,
    },
  ]);

  if (!confirm) {
    log.warn('Setup cancelled.');
    process.exit(0);
  }

  // Execute cleanup
  console.log('\n');

  const pathsToRemove = [];
  const depsToRemove = [];

  // Collect paths and deps
  for (const key of toRemove.databases) {
    const config = FEATURES.database[key];
    pathsToRemove.push(...config.paths);
    depsToRemove.push(...config.deps);
  }
  for (const key of toRemove.auth) {
    const config = FEATURES.auth[key];
    pathsToRemove.push(...config.paths);
    depsToRemove.push(...config.deps);
  }
  for (const key of toRemove.features) {
    const config = FEATURES.optional[key];
    pathsToRemove.push(...config.paths);
    depsToRemove.push(...config.deps);
  }

  // 1. Remove files
  log.step('Removing unused files...');
  for (const relPath of pathsToRemove) {
    const fullPath = join(ROOT, relPath);
    if (existsSync(fullPath)) {
      try {
        rmSync(fullPath, { recursive: true, force: true });
        log.success(`Removed: ${relPath}`);
      } catch (err) {
        log.error(`Failed: ${relPath}`);
      }
    }
  }

  // 2. Update app.module.ts
  log.step('Updating app.module.ts...');
  updateAppModule(toRemove.features);

  // 3. Update persistence/index.ts
  log.step('Updating persistence exports...');
  updatePersistenceIndex(database);

  // 4. Update auth strategies index
  if (toRemove.auth.length > 0) {
    log.step('Updating auth strategies...');
    updateAuthStrategiesIndex(authStrategies);
  }

  // 5. Update modules index
  log.step('Updating modules exports...');
  updateModulesIndex(optionalFeatures);

  // 6. Update infrastructure index
  log.step('Updating infrastructure exports...');
  updateInfrastructureIndex(optionalFeatures);

  // 7. Remove dependencies
  if (depsToRemove.length > 0) {
    log.step('Removing unused dependencies...');
    const uniqueDeps = [...new Set(depsToRemove)].filter(Boolean);
    if (uniqueDeps.length > 0) {
      try {
        execSync(`pnpm remove ${uniqueDeps.join(' ')} 2>/dev/null || true`, {
          cwd: ROOT,
          stdio: 'inherit',
        });
        log.success(`Removed ${uniqueDeps.length} dependencies`);
      } catch (err) {
        log.warn('Some dependencies could not be removed.');
      }
    }
  }

  // Final message
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Setup Complete!                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');
  log.info('Next steps:');
  console.log('  1. Run: pnpm lint:fix');
  console.log('  2. Run: pnpm build');
  console.log('  3. Update your .env file');
  if (database === 'typeorm') {
    console.log('  4. Run migrations: pnpm migration:run');
  } else if (database === 'prisma') {
    console.log('  4. Run: npx prisma generate && npx prisma migrate dev');
  } else if (database === 'mongoose') {
    console.log('  4. Configure MongoDB connection in .env');
  }
  console.log('\n');
}

function updateAppModule(featuresToRemove) {
  const appModulePath = join(ROOT, 'src/app.module.ts');
  let content = readFileSync(appModulePath, 'utf-8');

  for (const featureKey of featuresToRemove) {
    const config = FEATURES.optional[featureKey];
    if (!config) continue;

    // Remove import statement
    if (config.importPattern) {
      content = content.replace(config.importPattern, '');
    }

    // Remove from imports array
    if (config.modulePattern) {
      content = content.replace(config.modulePattern, '\n');
    }
    if (config.modulePattern2) {
      content = content.replace(config.modulePattern2, '\n');
    }
  }

  // Also handle individual import removals for storage (2 separate imports)
  if (featuresToRemove.includes('storage')) {
    content = content.replace(/import \{ StorageModule \} from '\.\/infrastructure\/storage';\n/, '');
    content = content.replace(/import \{ FileModule \} from '\.\/modules\/file';\n/, '');
  }

  // Clean up formatting
  content = content.replace(/,\s*\n\s*\n/g, ',\n');
  content = content.replace(/\n{3,}/g, '\n\n');

  writeFileSync(appModulePath, content);
  log.success('Updated app.module.ts');
}

function updatePersistenceIndex(database) {
  const indexPath = join(ROOT, 'src/infrastructure/persistence/index.ts');

  let content = '';
  if (database === 'typeorm') {
    content = `// TypeORM (PostgreSQL)
export * from './typeorm/database.module';
export * from './typeorm/base';
export * from './typeorm/entities';
export * from './typeorm/repositories';
export * from './mappers';
`;
  } else if (database === 'prisma') {
    content = `// Prisma
export * from './prisma';
export * from './mappers';
`;
  } else if (database === 'mongoose') {
    content = `// Mongoose (MongoDB)
export * from './mongoose';
export * from './mappers';
`;
  }

  writeFileSync(indexPath, content);
  log.success('Updated persistence/index.ts');
}

function updateAuthStrategiesIndex(authStrategies) {
  const indexPath = join(ROOT, 'src/modules/auth/infrastructure/strategies/index.ts');

  if (!existsSync(indexPath)) return;

  const exports = [];
  if (authStrategies.includes('google')) {
    exports.push("export * from './google.strategy';");
  }
  if (authStrategies.includes('facebook')) {
    exports.push("export * from './facebook.strategy';");
  }
  if (authStrategies.includes('apple')) {
    exports.push("export * from './apple.strategy';");
  }

  const content = exports.length > 0 ? exports.join('\n') + '\n' : '// No OAuth strategies configured\n';

  writeFileSync(indexPath, content);
  log.success('Updated auth strategies index');
}

function updateModulesIndex(optionalFeatures) {
  const indexPath = join(ROOT, 'src/modules/index.ts');
  let content = readFileSync(indexPath, 'utf-8');

  if (!optionalFeatures.includes('storage')) {
    content = content.replace(/export \* from '\.\/file';\n?/g, '');
  }
  if (!optionalFeatures.includes('audit')) {
    content = content.replace(/export \* from '\.\/audit';\n?/g, '');
  }

  // Clean up empty lines
  content = content.replace(/\n{2,}/g, '\n');

  writeFileSync(indexPath, content);
  log.success('Updated modules/index.ts');
}

function updateInfrastructureIndex(optionalFeatures) {
  const indexPath = join(ROOT, 'src/infrastructure/index.ts');

  if (!existsSync(indexPath)) return;

  let content = readFileSync(indexPath, 'utf-8');

  const featureToExport = {
    graphql: './graphql',
    websocket: './websocket',
    jobs: './jobs',
    i18n: './i18n',
    metrics: './metrics',
    email: './email',
    storage: './storage',
  };

  for (const [feature, exportPath] of Object.entries(featureToExport)) {
    if (!optionalFeatures.includes(feature)) {
      const pattern = new RegExp(`export \\* from '${exportPath.replace('./', '\\.\\/') }';\n?`, 'g');
      content = content.replace(pattern, '');
    }
  }

  // Clean up
  content = content.replace(/\n{2,}/g, '\n');

  writeFileSync(indexPath, content);
  log.success('Updated infrastructure/index.ts');
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
