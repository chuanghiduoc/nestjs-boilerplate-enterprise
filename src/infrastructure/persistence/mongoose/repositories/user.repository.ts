import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
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
import { Email } from '@modules/user/domain/value-objects/email.value-object';
import { Password } from '@modules/user/domain/value-objects/password.value-object';
import { USER_MODEL } from '../mongoose.module';
import { MongoUserStatus, type IUserDocument } from '../schemas/user.schema';
import { BaseMongooseRepository, type IMongooseMapper } from '../base/base-repository.mongoose';

/**
 * User Document with Mongoose Document interface
 */
type UserDocument = HydratedDocument<IUserDocument>;

/**
 * User Mapper for Mongoose
 */
class MongooseUserMapper implements IMongooseMapper<User, UserDocument> {
  private mapMongoStatusToDomain(status: MongoUserStatus): UserStatus {
    const mapping: Record<MongoUserStatus, UserStatus> = {
      ACTIVE: UserStatus.ACTIVE,
      INACTIVE: UserStatus.INACTIVE,
      PENDING_VERIFICATION: UserStatus.PENDING,
      SUSPENDED: UserStatus.SUSPENDED,
    };
    return mapping[status] || UserStatus.PENDING;
  }

  private mapDomainStatusToMongo(status: UserStatus): MongoUserStatus {
    const mapping: Record<UserStatus, MongoUserStatus> = {
      [UserStatus.ACTIVE]: 'ACTIVE' as MongoUserStatus,
      [UserStatus.INACTIVE]: 'INACTIVE' as MongoUserStatus,
      [UserStatus.PENDING]: 'PENDING_VERIFICATION' as MongoUserStatus,
      [UserStatus.SUSPENDED]: 'SUSPENDED' as MongoUserStatus,
      [UserStatus.DELETED]: 'INACTIVE' as MongoUserStatus, // Map deleted to inactive for MongoDB
    };
    return mapping[status] || ('PENDING_VERIFICATION' as MongoUserStatus);
  }

  toDomain(doc: UserDocument): User {
    return User.reconstitute(doc._id, {
      email: Email.create(doc.email),
      password: Password.fromHash(doc.passwordHash),
      firstName: doc.firstName || '',
      lastName: doc.lastName || '',
      status: this.mapMongoStatusToDomain(doc.status),
      tenantId: doc.tenantId || '',
      roleIds: doc.roles || [],
      emailVerified: doc.emailVerified,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(entity: User): Record<string, unknown> {
    return {
      email: entity.email.value,
      passwordHash: entity.password.hashedValue,
      firstName: entity.firstName,
      lastName: entity.lastName,
      status: this.mapDomainStatusToMongo(entity.status),
      tenantId: entity.tenantId,
      roles: [...entity.roleIds],
      emailVerified: entity.emailVerified,
    };
  }

  toDomainList(docs: UserDocument[]): User[] {
    return docs.map((doc) => this.toDomain(doc));
  }
}

/**
 * Mongoose User Repository Implementation
 *
 * Implements IUserRepository using Mongoose for MongoDB.
 *
 * Section 8.3: Repository Contract
 * Section 8.6: Database Switching Guide - MongoDB implementation
 */
@Injectable()
export class MongooseUserRepository
  extends BaseMongooseRepository<User, IUserDocument, UserFilterCriteria>
  implements IUserRepository
{
  private readonly userMapper: MongooseUserMapper;

  constructor(
    @InjectModel(USER_MODEL)
    model: Model<IUserDocument>,
  ) {
    const mapper = new MongooseUserMapper();
    super(model, mapper);
    this.userMapper = mapper;
  }

  protected toFilterQuery(criteria: UserFilterCriteria): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (criteria.email) {
      filter.email = criteria.email.toLowerCase();
    }

    if (criteria.status) {
      filter.status = criteria.status;
    }

    if (criteria.tenantId) {
      filter.tenantId = criteria.tenantId;
    }

    if (criteria.emailVerified !== undefined) {
      filter.emailVerified = criteria.emailVerified;
    }

    if (criteria.roleId) {
      filter.roles = criteria.roleId;
    }

    if (criteria.search) {
      filter.$or = [
        { email: { $regex: criteria.search, $options: 'i' } },
        { firstName: { $regex: criteria.search, $options: 'i' } },
        { lastName: { $regex: criteria.search, $options: 'i' } },
      ];
    }

    return filter;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const doc = await this.model.findOne({ email: email.toLowerCase(), tenantId }).exec();

    return doc ? this.userMapper.toDomain(doc) : null;
  }

  async findByEmailGlobal(email: string): Promise<User | null> {
    const doc = await this.model.findOne({ email: email.toLowerCase() }).exec();

    return doc ? this.userMapper.toDomain(doc) : null;
  }

  async findByRole(
    roleId: string,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<User>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const sortObj: Record<string, 1 | -1> = {};
    if (sort) {
      sortObj[sort.field] = sort.order === 'ASC' ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const filter = { roles: roleId };

    const [docs, total] = await Promise.all([
      this.model.find(filter).skip(skip).limit(limit).sort(sortObj).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: this.userMapper.toDomainList(docs),
      total,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async emailExists(email: string, tenantId: string, excludeUserId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = {
      email: email.toLowerCase(),
      tenantId,
    };

    if (excludeUserId) {
      filter._id = { $ne: excludeUserId };
    }

    const count = await this.model.countDocuments(filter).exec();
    return count > 0;
  }

  async countActiveInTenant(tenantId: string): Promise<number> {
    return this.model
      .countDocuments({
        tenantId,
        status: MongoUserStatus.ACTIVE,
      })
      .exec();
  }

  async findPendingActivation(olderThan: Date): Promise<User[]> {
    const docs = await this.model
      .find({
        status: MongoUserStatus.PENDING_VERIFICATION,
        createdAt: { $lt: olderThan },
      })
      .exec();

    return this.userMapper.toDomainList(docs);
  }
}
