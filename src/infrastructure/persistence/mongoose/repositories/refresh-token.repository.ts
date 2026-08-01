import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
import { REFRESH_TOKEN_MODEL } from '../mongoose.module';
import type { IRefreshTokenDocument } from '../schemas/refresh-token.schema';
import type {
  IRefreshTokenRepository,
  CreateRefreshTokenData,
} from '../../typeorm/repositories/refresh-token.repository';

/**
 * Refresh Token Document with Mongoose Document interface
 */
type RefreshTokenDocument = HydratedDocument<IRefreshTokenDocument>;

/**
 * Refresh Token Entity for Mongoose responses
 * Matches the structure expected by IRefreshTokenRepository
 */
interface RefreshTokenEntity {
  id: string;
  userId: string;
  token: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  revokedAt?: Date;
  replacedByTokenId?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isValid: boolean;
  isExpired: boolean;
  isRevoked: boolean;
}

/**
 * Mongoose Refresh Token Repository Implementation
 *
 * Handles refresh token persistence for JWT authentication using MongoDB.
 *
 * Section 12.5: JWT Security Best Practices
 * Section 8.6: Database Switching Guide - MongoDB implementation
 */
@Injectable()
export class MongooseRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    @InjectModel(REFRESH_TOKEN_MODEL)
    private readonly model: Model<IRefreshTokenDocument>,
  ) {}

  private toEntity(doc: RefreshTokenDocument): RefreshTokenEntity {
    const now = new Date();
    const isExpired = doc.expiresAt <= now;
    const isRevoked = doc.isRevoked;
    return {
      id: doc._id,
      userId: doc.userId,
      token: doc.token,
      familyId: doc.familyId || '',
      expiresAt: doc.expiresAt,
      userAgent: doc.userAgent,
      ipAddress: doc.ipAddress,
      deviceId: doc.deviceId,
      revokedAt: doc.revokedAt,
      replacedByTokenId: doc.replacedByTokenId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: 1,
      isValid: !isExpired && !isRevoked,
      isExpired,
      isRevoked,
    };
  }

  async create(data: CreateRefreshTokenData): Promise<RefreshTokenEntity> {
    const doc = new this.model({
      userId: data.userId,
      token: data.token,
      familyId: data.familyId,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      deviceId: data.deviceId,
      isRevoked: false,
    });

    const saved = await doc.save();
    return this.toEntity(saved);
  }

  async findByToken(token: string): Promise<RefreshTokenEntity | null> {
    const doc = await this.model.findOne({ token }).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(userId: string): Promise<RefreshTokenEntity[]> {
    const docs = await this.model.find({ userId, isRevoked: false }).sort({ createdAt: -1 }).exec();

    return docs.map((doc) => this.toEntity(doc));
  }

  async revokeToken(id: string, replacedByTokenId?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      isRevoked: true,
      revokedAt: new Date(),
    };

    if (replacedByTokenId) {
      updateData.replacedByTokenId = replacedByTokenId;
    }

    await this.model.updateOne({ _id: id }, { $set: updateData }).exec();
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.model
      .updateMany(
        { userId, isRevoked: false },
        {
          $set: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    await this.model
      .updateMany(
        { familyId, isRevoked: false },
        {
          $set: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.model
      .deleteMany({
        expiresAt: { $lt: new Date() },
      })
      .exec();

    return result.deletedCount ?? 0;
  }

  async isTokenValid(token: string): Promise<boolean> {
    const entity = await this.findByToken(token);
    return entity ? entity.isValid : false;
  }
}
