import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere, ILike } from 'typeorm';
import type {
  PaginatedResult,
  PaginationParams,
  SortParams,
} from '@core/domain/ports/repositories';
import { User } from '@modules/user/domain/entities/user.entity';
import { UserStatus } from '@modules/user/domain/enums/user-status.enum';
import type {
  IUserRepository,
  UserFilterCriteria,
} from '@modules/user/domain/repositories/user.repository.interface';
import { UserEntity } from '../entities/user.entity';
import { UserMapper } from '../../mappers/user.mapper';
import { createTransactionAwareRepository } from '../base/transaction-context.typeorm';

/**
 * TypeORM User Repository Implementation
 *
 * Implements IUserRepository using TypeORM.
 *
 * Section 8.3: Repository Contract
 * Section 8.6: Database Switching Guide
 */
@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  private static readonly SORTABLE_FIELDS = new Set([
    'id',
    'email',
    'firstName',
    'lastName',
    'status',
    'emailVerified',
    'createdAt',
    'updatedAt',
  ]);

  private readonly repository: Repository<UserEntity>;

  constructor(
    @InjectRepository(UserEntity)
    repository: Repository<UserEntity>,
  ) {
    this.repository = createTransactionAwareRepository(repository);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { roles: true },
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findOne(criteria: UserFilterCriteria): Promise<User | null> {
    const where = this.buildWhereClause(criteria);
    const entity = await this.repository.findOne({
      where,
      relations: { roles: true },
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findMany(
    criteria: UserFilterCriteria,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<User>> {
    const where = this.buildWhereClause(criteria);
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const orderField = this.resolveSortField(sort?.field);
    const orderDirection = sort?.order || 'DESC';

    const [entities, total] = await this.repository.findAndCount({
      where,
      relations: { roles: true },
      skip,
      take: limit,
      order: { [orderField]: orderDirection },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: UserMapper.toDomainList(entities),
      total,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async save(user: User): Promise<User> {
    const ormEntity = UserMapper.toOrm(user);
    const saved = await this.repository.save(ormEntity as UserEntity);
    return UserMapper.toDomain(saved);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async exists(criteria: UserFilterCriteria): Promise<boolean> {
    const where = this.buildWhereClause(criteria);
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async count(criteria: UserFilterCriteria): Promise<number> {
    const where = this.buildWhereClause(criteria);
    return this.repository.count({ where });
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { email: email.toLowerCase(), tenantId },
      relations: { roles: true },
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByEmailGlobal(email: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { email: email.toLowerCase() },
      relations: { roles: true },
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByRole(
    roleId: string,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<User>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const orderField = this.resolveSortField(sort?.field);
    const orderDirection = sort?.order || 'DESC';

    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .where('role.id = :roleId', { roleId })
      .skip(skip)
      .take(limit)
      .orderBy(`user.${orderField}`, orderDirection);

    const [entities, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data: UserMapper.toDomainList(entities),
      total,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async emailExists(email: string, tenantId: string, excludeUserId?: string): Promise<boolean> {
    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: email.toLowerCase() })
      .andWhere('user.tenantId = :tenantId', { tenantId });

    if (excludeUserId) {
      queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const count = await queryBuilder.getCount();
    return count > 0;
  }

  async countActiveInTenant(tenantId: string): Promise<number> {
    return this.repository.count({
      where: { tenantId, status: UserStatus.ACTIVE },
    });
  }

  async findPendingActivation(olderThan: Date): Promise<User[]> {
    const entities = await this.repository
      .createQueryBuilder('user')
      .where('user.status = :status', { status: UserStatus.PENDING })
      .andWhere('user.createdAt < :olderThan', { olderThan })
      .getMany();

    return UserMapper.toDomainList(entities);
  }

  /**
   * Build TypeORM where clause from filter criteria
   */
  private buildWhereClause(filter?: UserFilterCriteria): FindOptionsWhere<UserEntity> {
    const where: FindOptionsWhere<UserEntity> = {};

    if (!filter) {
      return where;
    }

    if (filter.email) {
      where.email = filter.email.toLowerCase();
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.tenantId) {
      where.tenantId = filter.tenantId;
    }

    if (filter.emailVerified !== undefined) {
      where.emailVerified = filter.emailVerified;
    }

    if (filter.search) {
      // For search, we need to use ILike
      where.email = ILike(`%${filter.search}%`);
    }

    return where;
  }

  private resolveSortField(field?: string): string {
    return field && TypeOrmUserRepository.SORTABLE_FIELDS.has(field) ? field : 'createdAt';
  }
}
