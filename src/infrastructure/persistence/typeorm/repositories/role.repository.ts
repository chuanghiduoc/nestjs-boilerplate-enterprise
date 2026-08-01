import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere, In } from 'typeorm';
import type {
  PaginatedResult,
  PaginationParams,
  SortParams,
} from '@core/domain/ports/repositories';
import { Role } from '@modules/role/domain/entities/role.entity';
import type {
  IRoleRepository,
  RoleFilterCriteria,
} from '@modules/role/domain/repositories/role.repository.interface';
import { RoleEntity } from '../entities/role.entity';
import { RoleMapper } from '../../mappers/role.mapper';
import { createTransactionAwareRepository } from '../base/transaction-context.typeorm';

/**
 * TypeORM Role Repository Implementation
 *
 * Implements IRoleRepository using TypeORM.
 *
 * Section 8.3: Repository Contract
 */
@Injectable()
export class TypeOrmRoleRepository implements IRoleRepository {
  private readonly repository: Repository<RoleEntity>;

  constructor(
    @InjectRepository(RoleEntity)
    repository: Repository<RoleEntity>,
  ) {
    this.repository = createTransactionAwareRepository(repository);
  }

  async findById(id: string): Promise<Role | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findOne(criteria: RoleFilterCriteria): Promise<Role | null> {
    const where = this.buildWhereClause(criteria);
    const entity = await this.repository.findOne({ where });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findMany(
    criteria: RoleFilterCriteria,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<Role>> {
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
      data: RoleMapper.toDomainList(entities),
      total,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async save(role: Role): Promise<Role> {
    const ormEntity = RoleMapper.toOrm(role);
    const saved = await this.repository.save(ormEntity as RoleEntity);
    return RoleMapper.toDomain(saved);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async exists(criteria: RoleFilterCriteria): Promise<boolean> {
    const where = this.buildWhereClause(criteria);
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async count(criteria: RoleFilterCriteria): Promise<number> {
    const where = this.buildWhereClause(criteria);
    return this.repository.count({ where });
  }

  async findByName(name: string, tenantId: string): Promise<Role | null> {
    const entity = await this.repository.findOne({
      where: { name, tenantId },
    });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    if (ids.length === 0) {
      return [];
    }

    const entities = await this.repository.find({
      where: { id: In(ids) },
    });
    return RoleMapper.toDomainList(entities);
  }

  async findSystemRoles(): Promise<Role[]> {
    const entities = await this.repository.find({
      where: { isSystem: true },
    });
    return RoleMapper.toDomainList(entities);
  }

  /**
   * Build TypeORM where clause from filter criteria
   */
  private buildWhereClause(filter?: RoleFilterCriteria): FindOptionsWhere<RoleEntity> {
    const where: FindOptionsWhere<RoleEntity> = {};

    if (!filter) {
      return where;
    }

    if (filter.name) {
      where.name = filter.name;
    }

    if (filter.tenantId) {
      where.tenantId = filter.tenantId;
    }

    if (filter.isSystem !== undefined) {
      where.isSystem = filter.isSystem;
    }

    return where;
  }
}
