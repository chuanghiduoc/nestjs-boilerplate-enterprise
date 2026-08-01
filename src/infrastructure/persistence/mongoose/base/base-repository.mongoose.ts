import type { HydratedDocument, Model } from 'mongoose';
import type { AggregateRoot } from '@core/domain/base';
import type {
  IRepository,
  FilterCriteria,
  PaginationParams,
  SortParams,
  PaginatedResult,
} from '@core/domain/ports/repositories';

/**
 * Mapper Interface for Mongoose
 * Converts between Domain Entity and Mongoose Document
 */
export interface IMongooseMapper<TDomain, TDocument> {
  toDomain(doc: TDocument): TDomain;
  toPersistence(domainEntity: TDomain): Record<string, unknown>;
  toDomainList(docs: TDocument[]): TDomain[];
}

/**
 * Base Mongoose Repository
 *
 * Abstract base class for Mongoose repository implementations.
 * Implements the IRepository interface from Domain layer.
 *
 * Section 8.3: Repository Contract
 * Section 8.6: Database Switching Guide - MongoDB implementation
 */
export abstract class BaseMongooseRepository<
  TAggregate extends AggregateRoot,
  TSchema extends { _id: string },
  TFilter extends FilterCriteria = FilterCriteria,
> implements IRepository<TAggregate, string, TFilter> {
  constructor(
    protected readonly model: Model<TSchema>,
    protected readonly mapper: IMongooseMapper<TAggregate, HydratedDocument<TSchema>>,
  ) {}

  /**
   * Convert filter criteria to Mongoose filter query
   * Override in subclass for specific entity filters
   */
  protected abstract toFilterQuery(criteria: TFilter): Record<string, unknown>;

  async findById(id: string): Promise<TAggregate | null> {
    const doc = await this.model.findById(id).exec();

    if (!doc) {
      return null;
    }

    return this.mapper.toDomain(doc);
  }

  async findOne(criteria: TFilter): Promise<TAggregate | null> {
    const filter = this.toFilterQuery(criteria);
    const doc = await this.model.findOne(filter).exec();

    if (!doc) {
      return null;
    }

    return this.mapper.toDomain(doc);
  }

  async findMany(
    criteria: TFilter,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<TAggregate>> {
    const filter = this.toFilterQuery(criteria);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = pagination?.offset ?? (page - 1) * limit;

    const sortObj: Record<string, 1 | -1> = {};
    if (sort) {
      sortObj[sort.field] = sort.order === 'ASC' ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const [docs, total] = await Promise.all([
      this.model.find(filter).skip(skip).limit(limit).sort(sortObj).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const data = this.mapper.toDomainList(docs);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async save(entity: TAggregate): Promise<TAggregate> {
    const data = this.mapper.toPersistence(entity);

    const existingDoc = await this.model.findById(entity.id).exec();

    let savedDoc: HydratedDocument<TSchema>;
    if (existingDoc) {
      Object.assign(existingDoc, data);
      savedDoc = await existingDoc.save();
    } else {
      const newDoc = new this.model({ _id: entity.id, ...data });
      savedDoc = await newDoc.save();
    }

    return this.mapper.toDomain(savedDoc);
  }

  async saveMany(entities: TAggregate[]): Promise<TAggregate[]> {
    const results: TAggregate[] = [];
    for (const entity of entities) {
      const saved = await this.save(entity);
      results.push(saved);
    }
    return results;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id } as Record<string, unknown>).exec();
    return result.deletedCount > 0;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.model
      .updateOne({ _id: id } as Record<string, unknown>, { $set: { deletedAt: new Date() } })
      .exec();
    return result.modifiedCount > 0;
  }

  async exists(criteria: TFilter): Promise<boolean> {
    const filter = this.toFilterQuery(criteria);
    const count = await this.model.countDocuments(filter).exec();
    return count > 0;
  }

  async count(criteria: TFilter): Promise<number> {
    const filter = this.toFilterQuery(criteria);
    return this.model.countDocuments(filter).exec();
  }
}
