import {
  PrimaryColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Base TypeORM Entity
 *
 * All ORM entities should extend this class.
 * Provides common columns for auditing and soft delete.
 *
 * Section 8.2: Entity Separation - ORM entities have decorators
 */
export abstract class BaseTypeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date | null;

  @VersionColumn({ default: 0 })
  version!: number;
}

/**
 * Base TypeORM Entity with Tenant Support
 */
export abstract class BaseTenantTypeOrmEntity extends BaseTypeOrmEntity {
  @PrimaryColumn('uuid', { name: 'tenant_id' })
  tenantId!: string;
}
