#!/usr/bin/env node
/**
 * Quick Cleanup Script
 *
 * Remove specific features without the full wizard.
 *
 * Usage:
 *   pnpm cleanup:db        # Remove unused database adapters
 *   pnpm cleanup:auth      # Remove unused OAuth strategies
 *   pnpm cleanup:feature   # Remove optional features
 */

import inquirer from 'inquirer';
import { rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

const CLEANUP_OPTIONS = {
  database: {
    title: 'Database Adapters',
    items: [
      {
        name: 'Prisma',
        value: 'prisma',
        paths: ['src/infrastructure/persistence/prisma'],
        deps: ['@prisma/client', 'prisma'],
      },
      {
        name: 'Mongoose (MongoDB)',
        value: 'mongoose',
        paths: ['src/infrastructure/persistence/mongoose'],
        deps: ['mongoose', '@nestjs/mongoose'],
      },
      {
        name: 'TypeORM',
        value: 'typeorm',
        paths: ['src/infrastructure/persistence/typeorm'],
        deps: ['typeorm', '@nestjs/typeorm', 'pg'],
      },
    ],
  },
  auth: {
    title: 'OAuth Strategies',
    items: [
      {
        name: 'Google OAuth',
        value: 'google',
        paths: ['src/modules/auth/infrastructure/strategies/google.strategy.ts'],
        deps: ['passport-google-oauth20', '@types/passport-google-oauth20'],
      },
      {
        name: 'Facebook OAuth',
        value: 'facebook',
        paths: ['src/modules/auth/infrastructure/strategies/facebook.strategy.ts'],
        deps: ['passport-facebook', '@types/passport-facebook'],
      },
      {
        name: 'Apple OAuth',
        value: 'apple',
        paths: ['src/modules/auth/infrastructure/strategies/apple.strategy.ts'],
        deps: ['passport-apple'],
      },
    ],
  },
  feature: {
    title: 'Optional Features',
    items: [
      {
        name: 'GraphQL API',
        value: 'graphql',
        paths: ['src/infrastructure/graphql', 'src/modules/user/presentation/graphql'],
        deps: ['@nestjs/graphql', '@nestjs/apollo', '@apollo/server', 'graphql'],
      },
      {
        name: 'WebSocket',
        value: 'websocket',
        paths: ['src/infrastructure/websocket'],
        deps: ['@nestjs/websockets', '@nestjs/platform-socket.io', 'socket.io'],
      },
      {
        name: 'Background Jobs (Bull)',
        value: 'jobs',
        paths: ['src/infrastructure/jobs'],
        deps: ['@nestjs/bull', 'bull', '@types/bull'],
      },
      {
        name: 'Internationalization (i18n)',
        value: 'i18n',
        paths: ['src/infrastructure/i18n'],
        deps: ['nestjs-i18n'],
      },
      {
        name: 'Metrics & Tracing',
        value: 'metrics',
        paths: ['src/infrastructure/metrics'],
        deps: ['prom-client', '@opentelemetry/api', '@opentelemetry/sdk-node', '@opentelemetry/auto-instrumentations-node', '@opentelemetry/exporter-prometheus'],
      },
      {
        name: 'Email (Nodemailer)',
        value: 'email',
        paths: ['src/infrastructure/email'],
        deps: ['nodemailer', '@types/nodemailer', 'handlebars'],
      },
      {
        name: 'File Storage (S3/Local)',
        value: 'storage',
        paths: ['src/infrastructure/storage', 'src/modules/file'],
        deps: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', 'multer', '@types/multer'],
      },
      {
        name: 'Audit Logging',
        value: 'audit',
        paths: ['src/modules/audit'],
        deps: [],
      },
    ],
  },
};

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find((a) => a.startsWith('--type='));
  const type = typeArg ? typeArg.split('=')[1] : null;

  if (!type || !CLEANUP_OPTIONS[type]) {
    console.log('\nUsage:');
    console.log('  pnpm cleanup:db       Remove unused database adapters');
    console.log('  pnpm cleanup:auth     Remove unused OAuth strategies');
    console.log('  pnpm cleanup:feature  Remove optional features\n');
    process.exit(1);
  }

  const config = CLEANUP_OPTIONS[type];
  console.log(`\n${colors.cyan}${config.title} Cleanup${colors.reset}\n`);

  // Filter to only show items that exist
  const availableItems = config.items.filter((item) =>
    item.paths.some((p) => existsSync(join(ROOT, p)))
  );

  if (availableItems.length === 0) {
    log.info('No items available to remove.');
    process.exit(0);
  }

  const { toRemove } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'toRemove',
      message: 'Select items to REMOVE:',
      choices: availableItems.map((item) => ({
        name: item.name,
        value: item.value,
      })),
    },
  ]);

  if (toRemove.length === 0) {
    log.info('Nothing selected. Exiting.');
    process.exit(0);
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove ${toRemove.length} item(s)?`,
      default: false,
    },
  ]);

  if (!confirm) {
    log.warn('Cancelled.');
    process.exit(0);
  }

  // Execute removal
  const pathsToRemove = [];
  const depsToRemove = [];

  for (const value of toRemove) {
    const item = config.items.find((i) => i.value === value);
    if (item) {
      pathsToRemove.push(...item.paths);
      depsToRemove.push(...item.deps);
    }
  }

  // Remove paths
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

  // Remove dependencies
  if (depsToRemove.length > 0) {
    const uniqueDeps = [...new Set(depsToRemove)];
    log.info(`Removing ${uniqueDeps.length} dependencies...`);
    try {
      execSync(`pnpm remove ${uniqueDeps.join(' ')}`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    } catch (err) {
      log.warn('Some dependencies could not be removed.');
    }
  }

  console.log('\n');
  log.success('Cleanup complete!');
  log.info('Run: pnpm lint:fix && pnpm build');
  console.log('\n');
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
