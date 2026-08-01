import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
import { Role } from '@modules/role/domain/entities/role.entity';
import type {
  IRoleRepository,
  RoleFilterCriteria,
} from '@modules/role/domain/repositories/role.repository.interface';
import { ROLE_MODEL } from '../mongoose.module';
import type { IRoleDocument } from '../schemas/role.schema';
import { BaseMongooseRepository, type IMongooseMapper } from '../base/base-repository.mongoose';

/**
 * Role Document with Mongoose Document interface
 */
type RoleDocument = HydratedDocument<IRoleDocument>;

/**
 * Role Mapper for Mongoose
 */
class MongooseRoleMapper implements IMongooseMapper<Role, RoleDocument> {
  toDomain(doc: RoleDocument): Role {
    return Role.reconstitute(doc._id, {
      name: doc.name,
      description: doc.description,
      permissions: doc.permissions || [],
      tenantId: '', // MongoDB roles may be global
      isSystem: doc.isSystem,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(entity: Role): Record<string, unknown> {
    return {
      name: entity.name,
      description: entity.description,
      permissions: [...entity.permissions],
      isSystem: entity.isSystem,
    };
  }

  toDomainList(docs: RoleDocument[]): Role[] {
    return docs.map((doc) => this.toDomain(doc));
  }
}

/**
 * Mongoose Role Repository Implementation
 *
 * Implements IRoleRepository using Mongoose for MongoDB.
 *
 * Section 8.3: Repository Contract
 * Section 8.6: Database Switching Guide - MongoDB implementation
 */
@Injectable()
export class MongooseRoleRepository
  extends BaseMongooseRepository<Role, IRoleDocument, RoleFilterCriteria>
  implements IRoleRepository
{
  private readonly roleMapper: MongooseRoleMapper;

  constructor(
    @InjectModel(ROLE_MODEL)
    model: Model<IRoleDocument>,
  ) {
    const mapper = new MongooseRoleMapper();
    super(model, mapper);
    this.roleMapper = mapper;
  }

  protected toFilterQuery(criteria: RoleFilterCriteria): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (criteria.name) {
      filter.name = criteria.name;
    }

    if (criteria.isSystem !== undefined) {
      filter.isSystem = criteria.isSystem;
    }

    return filter;
  }

  async findByName(name: string, _tenantId: string): Promise<Role | null> {
    // MongoDB implementation - tenantId may not be used for global roles
    const doc = await this.model.findOne({ name }).exec();
    return doc ? this.roleMapper.toDomain(doc) : null;
  }

  async findSystemRoles(): Promise<Role[]> {
    const docs = await this.model.find({ isSystem: true }).exec();
    return this.roleMapper.toDomainList(docs);
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    const docs = await this.model.find({ _id: { $in: ids } }).exec();
    return this.roleMapper.toDomainList(docs);
  }
}
