import { DataSource, type DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { UserEntity } from './entities/user.entity';
import { RoleEntity } from './entities/role.entity';
import { TenantEntity } from './entities/tenant.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { AuditLogEntity } from '../../../modules/audit/infrastructure/entities/audit-log.typeorm.entity';

// Load environment variables
dotenv.config();

/**
 * TypeORM Data Source Configuration
 *
 * Used for running migrations and CLI operations.
 * Separate from NestJS module configuration.
 *
 * Section 8.6: Database Switching Guide
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'nestjs_boilerplate',
  schema: process.env.DB_SCHEMA || 'public',
  entities: [UserEntity, RoleEntity, TenantEntity, RefreshTokenEntity, AuditLogEntity],
  migrations: ['src/infrastructure/persistence/typeorm/migrations/*.ts'],
  synchronize: false, // Never use in production!
  logging: process.env.DB_LOGGING === 'true',
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
};

/**
 * Data Source instance for CLI operations
 */
const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
