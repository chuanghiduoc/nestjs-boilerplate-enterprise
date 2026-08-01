import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere, LessThan } from 'typeorm';
import type {
  PaginatedResult,
  PaginationParams,
  SortParams,
} from '@core/domain/ports/repositories';
import { Tenant, TenantStatus } from '@modules/tenant/domain/entities/tenant.entity';
import type {
  ITenantRepository,
  TenantFilterCriteria,
} from '@modules/tenant/domain/repositories/tenant.repository.interface';
import { TenantEntity } from '../entities/tenant.entity';
import { TenantMapper } from '../../mappers/tenant.mapper';
import { createTransactionAwareRepository } from '../base/transaction-context.typeorm';

/**
 * TypeORM Tenant Repository Implementation
 *
 * Implements ITenantRepository using TypeORM.
 *
 * Section 8.3: Repository Contract
 */
@Injectable()
export class TypeOrmTenantRepository implements ITenantRepository {
  private readonly repository: Repository<TenantEntity>;

  constructor(
    @InjectRepository(TenantEntity)
    repository: Repository<TenantEntity>,
  ) {
    this.repository = createTransactionAwareRepository(repository);
  }

  async findById(id: string): Promise<Tenant | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TenantMapper.toDomain(entity) : null;
  }

  async findOne(criteria: TenantFilterCriteria): Promise<Tenant | null> {
    const where = this.buildWhereClause(criteria);
    const entity = await this.repository.findOne({ where });
    return entity ? TenantMapper.toDomain(entity) : null;
  }

  async findMany(
    criteria: TenantFilterCriteria,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<Tenant>> {
    const where = this.buildWhereClause(criteria);
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const orderField = sort?.field || 'createdAt';
    const orderDirection = sort?.order || 'DESC';

    const [entities, total] = await this.repository.findAndCount({
      where,
      skip,
      take: limit,
      order: { [orderField]: orderDirection },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: TenantMapper.toDomainList(entities),
      total,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async save(tenant: Tenant): Promise<Tenant> {
    const ormEntity = TenantMapper.toOrm(tenant);
    const saved = await this.repository.save(ormEntity as TenantEntity);
    return TenantMapper.toDomain(saved);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async exists(criteria: TenantFilterCriteria): Promise<boolean> {
    const where = this.buildWhereClause(criteria);
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async count(criteria: TenantFilterCriteria): Promise<number> {
    const where = this.buildWhereClause(criteria);
    return this.repository.count({ where });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const entity = await this.repository.findOne({
      where: { slug: slug.toLowerCase() },
    });
    return entity ? TenantMapper.toDomain(entity) : null;
  }

  async findByOwner(ownerId: string): Promise<Tenant[]> {
    const entities = await this.repository.find({
      where: { ownerId },
    });
    return TenantMapper.toDomainList(entities);
  }

  async slugExists(slug: string, excludeTenantId?: string): Promise<boolean> {
    const queryBuilder = this.repository
      .createQueryBuilder('tenant')
      .where('tenant.slug = :slug', { slug: slug.toLowerCase() });

    if (excludeTenantId) {
      queryBuilder.andWhere('tenant.id != :excludeTenantId', { excludeTenantId });
    }

    const count = await queryBuilder.getCount();
    return count > 0;
  }

  async findExpiredTrials(): Promise<Tenant[]> {
    const now = new Date();
    const entities = await this.repository.find({
      where: {
        status: TenantStatus.TRIAL,
        trialEndsAt: LessThan(now),
      },
    });
    return TenantMapper.toDomainList(entities);
  }

  /**
   * Build TypeORM where clause from filter criteria
   */
  private buildWhereClause(filter?: TenantFilterCriteria): FindOptionsWhere<TenantEntity> {
    const where: FindOptionsWhere<TenantEntity> = {};

    if (!filter) {
      return where;
    }

    if (filter.name) {
      where.name = filter.name;
    }

    if (filter.slug) {
      where.slug = filter.slug.toLowerCase();
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.ownerId) {
      where.ownerId = filter.ownerId;
    }

    return where;
  }
}
