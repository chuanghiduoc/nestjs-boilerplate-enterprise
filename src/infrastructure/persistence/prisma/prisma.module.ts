import {
  Module,
  Global,
  type DynamicModule,
  Inject,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { UNIT_OF_WORK } from '@core/domain/ports/repositories';
import { EVENT_BUS, type IEventBus, type ILogger, LOGGER } from '@core/domain/ports/services';
import {
  createTransactionAwarePrismaClient,
  PrismaUnitOfWork,
  type PrismaClientWithTransaction,
} from './base/unit-of-work.prisma';

// Repositories
import { PrismaUserRepository } from './repositories/user.repository';
import { PrismaRoleRepository } from './repositories/role.repository';
import { PrismaTenantRepository } from './repositories/tenant.repository';
import { PrismaRefreshTokenRepository } from './repositories/refresh-token.repository';

// Repository tokens
import { USER_REPOSITORY } from '@modules/user/domain/repositories';
import { ROLE_REPOSITORY } from '@modules/role/domain/repositories';
import { TENANT_REPOSITORY } from '@modules/tenant/domain/repositories';
import { REFRESH_TOKEN_REPOSITORY } from '../typeorm/repositories/refresh-token.repository';

export const PRISMA_CLIENT = 'PRISMA_CLIENT';

/**
 * Prisma Service
 *
 * Wraps PrismaClient with lifecycle hooks.
 * Requires: pnpm add @prisma/client && pnpm add -D prisma
 */
class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient | null = null;

  constructor(
    private readonly logger: ILogger,
    private readonly logging: boolean,
  ) {}

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required when DB_ORM=prisma');
    }

    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
      log: this.logging ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    await this.client.$connect();
    this.logger.log('Prisma connected to database', 'PrismaService');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.logger.log('Prisma disconnected from database', 'PrismaService');
    }
  }

  getClient(): PrismaClientWithTransaction {
    if (!this.client) {
      throw new Error('Prisma client not initialized');
    }
    return this.client as unknown as PrismaClientWithTransaction;
  }
}

/**
 * Prisma Database Module
 *
 * Provides Prisma client and Unit of Work for dependency injection.
 *
 * Prerequisites:
 * 1. Install: pnpm add @prisma/client && pnpm add -D prisma
 * 2. Initialize: npx prisma init
 * 3. Configure schema in prisma/schema.prisma
 * 4. Generate client: npx prisma generate
 * 5. Run migrations: npx prisma migrate dev
 *
 * Section 8.6: Database Switching Guide
 */
@Global()
@Module({})
export class PrismaDatabaseModule implements OnModuleDestroy {
  constructor(@Inject(LOGGER) private readonly logger: ILogger) {}

  /**
   * Register Prisma module with async configuration
   */
  static forRootAsync(): DynamicModule {
    return {
      module: PrismaDatabaseModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        // Prisma Service (manages client lifecycle)
        {
          provide: PrismaService,
          useFactory: (logger: ILogger, configService: ConfigService) => {
            const logging = configService.get<boolean>('database.sql.logging', false);
            return new PrismaService(logger, logging);
          },
          inject: [LOGGER, ConfigService],
        },
        // Prisma Client
        {
          provide: PRISMA_CLIENT,
          useFactory: (prismaService: PrismaService) =>
            createTransactionAwarePrismaClient(prismaService.getClient()),
          inject: [PrismaService],
        },
        // Unit of Work
        {
          provide: UNIT_OF_WORK,
          useFactory: (prismaService: PrismaService, eventBus: IEventBus) => {
            return new PrismaUnitOfWork(prismaService.getClient(), eventBus);
          },
          inject: [PrismaService, EVENT_BUS],
        },
        // Repositories
        {
          provide: USER_REPOSITORY,
          useClass: PrismaUserRepository,
        },
        {
          provide: ROLE_REPOSITORY,
          useClass: PrismaRoleRepository,
        },
        {
          provide: TENANT_REPOSITORY,
          useClass: PrismaTenantRepository,
        },
        {
          provide: REFRESH_TOKEN_REPOSITORY,
          useClass: PrismaRefreshTokenRepository,
        },
      ],
      exports: [
        PRISMA_CLIENT,
        UNIT_OF_WORK,
        PrismaService,
        USER_REPOSITORY,
        ROLE_REPOSITORY,
        TENANT_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
      ],
    };
  }

  onModuleDestroy(): void {
    this.logger.log('Closing Prisma connections...', 'PrismaDatabaseModule');
  }
}
