import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
import { Tenant, TenantStatus } from '@modules/tenant/domain/entities/tenant.entity';
import type {
  ITenantRepository,
  TenantFilterCriteria,
} from '@modules/tenant/domain/repositories/tenant.repository.interface';
import { TENANT_MODEL } from '../mongoose.module';
import { MongoTenantStatus, type ITenantDocument } from '../schemas/tenant.schema';
import { BaseMongooseRepository, type IMongooseMapper } from '../base/base-repository.mongoose';

/**
 * Tenant Document with Mongoose Document interface
 */
type TenantDocument = HydratedDocument<ITenantDocument>;

/**
 * Tenant Mapper for Mongoose
 */
class MongooseTenantMapper implements IMongooseMapper<Tenant, TenantDocument> {
  private mapMongoStatusToDomain(status: MongoTenantStatus): TenantStatus {
    const mapping: Record<MongoTenantStatus, TenantStatus> = {
      ACTIVE: TenantStatus.ACTIVE,
      INACTIVE: TenantStatus.INACTIVE,
      TRIAL: TenantStatus.TRIAL,
      SUSPENDED: TenantStatus.SUSPENDED,
    };
    return mapping[status] || TenantStatus.ACTIVE;
  }

  private mapDomainStatusToMongo(status: TenantStatus): MongoTenantStatus {
    const mapping: Record<TenantStatus, MongoTenantStatus> = {
      [TenantStatus.ACTIVE]: 'ACTIVE' as MongoTenantStatus,
      [TenantStatus.INACTIVE]: 'INACTIVE' as MongoTenantStatus,
      [TenantStatus.TRIAL]: 'TRIAL' as MongoTenantStatus,
      [TenantStatus.SUSPENDED]: 'SUSPENDED' as MongoTenantStatus,
    };
    return mapping[status] || ('ACTIVE' as MongoTenantStatus);
  }

  toDomain(doc: TenantDocument): Tenant {
    return Tenant.reconstitute(doc._id, {
      name: doc.name,
      slug: doc.slug,
      status: this.mapMongoStatusToDomain(doc.status),
      settings: doc.settings || {},
      ownerId: doc.ownerId,
      trialEndsAt: doc.trialEndsAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(entity: Tenant): Record<string, unknown> {
    return {
      name: entity.name,
      slug: entity.slug,
      status: this.mapDomainStatusToMongo(entity.status),
      settings: entity.settings,
      ownerId: entity.ownerId,
      trialEndsAt: entity.trialEndsAt,
    };
  }

  toDomainList(docs: TenantDocument[]): Tenant[] {
    return docs.map((doc) => this.toDomain(doc));
  }
}

/**
 * Mongoose Tenant Repository Implementation
 *
 * Implements ITenantRepository using Mongoose for MongoDB.
 *
 * Section 8.3: Repository Contract
 * Section 8.6: Database Switching Guide - MongoDB implementation
 */
@Injectable()
export class MongooseTenantRepository
  extends BaseMongooseRepository<Tenant, ITenantDocument, TenantFilterCriteria>
  implements ITenantRepository
{
  private readonly tenantMapper: MongooseTenantMapper;

  constructor(
    @InjectModel(TENANT_MODEL)
    model: Model<ITenantDocument>,
  ) {
    const mapper = new MongooseTenantMapper();
    super(model, mapper);
    this.tenantMapper = mapper;
  }

  protected toFilterQuery(criteria: TenantFilterCriteria): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (criteria.name) {
      filter.name = { $regex: criteria.name, $options: 'i' };
    }

    if (criteria.slug) {
      filter.slug = criteria.slug;
    }

    if (criteria.status) {
      filter.status = criteria.status.toUpperCase();
    }

    if (criteria.ownerId) {
      filter.ownerId = criteria.ownerId;
    }

    return filter;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const doc = await this.model.findOne({ slug }).exec();
    return doc ? this.tenantMapper.toDomain(doc) : null;
  }

  async findByOwner(ownerId: string): Promise<Tenant[]> {
    const docs = await this.model.find({ ownerId }).exec();
    return this.tenantMapper.toDomainList(docs);
  }

  async slugExists(slug: string, excludeTenantId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { slug };

    if (excludeTenantId) {
      filter._id = { $ne: excludeTenantId };
    }

    const count = await this.model.countDocuments(filter).exec();
    return count > 0;
  }

  async findExpiredTrials(): Promise<Tenant[]> {
    const docs = await this.model
      .find({
        status: MongoTenantStatus.TRIAL,
        trialEndsAt: { $lt: new Date() },
      })
      .exec();

    return this.tenantMapper.toDomainList(docs);
  }
}
