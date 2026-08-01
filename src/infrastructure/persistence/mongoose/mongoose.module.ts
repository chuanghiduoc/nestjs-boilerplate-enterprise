import { Module, Global, type DynamicModule, Inject, type OnModuleDestroy } from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import mongoose, { type Connection } from 'mongoose';
import type { DatabaseConfig } from '@config/database.config';
import { UNIT_OF_WORK } from '@core/domain/ports/repositories';
import { EVENT_BUS, type IEventBus, type ILogger, LOGGER } from '@core/domain/ports/services';
import { MongooseUnitOfWork } from './base/unit-of-work.mongoose';

// Schemas
import { UserSchema } from './schemas/user.schema';
import { RoleSchema } from './schemas/role.schema';
import { TenantSchema } from './schemas/tenant.schema';
import { RefreshTokenSchema } from './schemas/refresh-token.schema';

// Repositories
import { MongooseUserRepository } from './repositories/user.repository';
import { MongooseRoleRepository } from './repositories/role.repository';
import { MongooseTenantRepository } from './repositories/tenant.repository';
import { MongooseRefreshTokenRepository } from './repositories/refresh-token.repository';

// Repository tokens
import { USER_REPOSITORY } from '@modules/user/domain/repositories';
import { ROLE_REPOSITORY } from '@modules/role/domain/repositories';
import { TENANT_REPOSITORY } from '@modules/tenant/domain/repositories';
import { REFRESH_TOKEN_REPOSITORY } from '../typeorm/repositories/refresh-token.repository';

export const USER_MODEL = 'User';
export const ROLE_MODEL = 'Role';
export const TENANT_MODEL = 'Tenant';
export const REFRESH_TOKEN_MODEL = 'RefreshToken';

// Automatically binds every Mongoose operation in Connection#transaction()
// to the transaction's session without leaking sessions across requests.
mongoose.set('transactionAsyncLocalStorage', true);

/**
 * Mongoose Database Module
 *
 * Provides MongoDB connectivity via Mongoose.
 * Auto-configured based on environment variables.
 *
 * Note: MongoDB transactions require a replica set or sharded cluster.
 *
 * Section 8.6: Database Switching Guide
 */
@Global()
@Module({})
export class MongooseDatabaseModule implements OnModuleDestroy {
  constructor(@Inject(LOGGER) private readonly logger: ILogger) {}

  /**
   * Register Mongoose module with async configuration
   */
  static forRootAsync(): DynamicModule {
    return {
      module: MongooseDatabaseModule,
      global: true,
      imports: [
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const dbConfig = configService.get<DatabaseConfig>('database');

            if (!dbConfig) {
              throw new Error('Database configuration not found');
            }

            const mongoConfig = dbConfig.mongodb;

            return {
              uri: mongoConfig.uri,
              maxPoolSize: mongoConfig.maxPoolSize,
              minPoolSize: mongoConfig.minPoolSize,
              serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMS,
              socketTimeoutMS: mongoConfig.socketTimeoutMS,
              connectTimeoutMS: mongoConfig.connectTimeoutMS,
              retryWrites: true,
              w: 'majority',
            };
          },
        }),
        // Register schemas
        MongooseModule.forFeature([
          { name: USER_MODEL, schema: UserSchema },
          { name: ROLE_MODEL, schema: RoleSchema },
          { name: TENANT_MODEL, schema: TenantSchema },
          { name: REFRESH_TOKEN_MODEL, schema: RefreshTokenSchema },
        ]),
      ],
      providers: [
        // Unit of Work
        {
          provide: UNIT_OF_WORK,
          useFactory: (connection: Connection, eventBus: IEventBus) => {
            return new MongooseUnitOfWork(connection, eventBus);
          },
          inject: [getConnectionToken(), EVENT_BUS],
        },
        // Repositories
        {
          provide: USER_REPOSITORY,
          useClass: MongooseUserRepository,
        },
        {
          provide: ROLE_REPOSITORY,
          useClass: MongooseRoleRepository,
        },
        {
          provide: TENANT_REPOSITORY,
          useClass: MongooseTenantRepository,
        },
        {
          provide: REFRESH_TOKEN_REPOSITORY,
          useClass: MongooseRefreshTokenRepository,
        },
      ],
      exports: [
        MongooseModule,
        UNIT_OF_WORK,
        USER_REPOSITORY,
        ROLE_REPOSITORY,
        TENANT_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
      ],
    };
  }

  onModuleDestroy(): void {
    this.logger.log('Closing MongoDB connections...', 'MongooseDatabaseModule');
  }
}
