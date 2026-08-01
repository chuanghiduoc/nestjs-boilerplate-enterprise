import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { createTransactionAwareRepository } from '../base/transaction-context.typeorm';

/**
 * Refresh Token Repository Interface
 */
export interface IRefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<RefreshTokenEntity>;
  findByToken(token: string): Promise<RefreshTokenEntity | null>;
  findByUserId(userId: string): Promise<RefreshTokenEntity[]>;
  revokeToken(id: string, replacedByTokenId?: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
  revokeTokenFamily(familyId: string): Promise<void>;
  deleteExpiredTokens(): Promise<number>;
  isTokenValid(token: string): Promise<boolean>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

/**
 * Create Refresh Token Data
 */
export interface CreateRefreshTokenData {
  userId: string;
  token: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
}

/**
 * TypeORM Refresh Token Repository Implementation
 *
 * Handles refresh token persistence for JWT authentication.
 *
 * Section 12.5: JWT Security Best Practices
 */
@Injectable()
export class TypeOrmRefreshTokenRepository implements IRefreshTokenRepository {
  private readonly repository: Repository<RefreshTokenEntity>;

  constructor(
    @InjectRepository(RefreshTokenEntity)
    repository: Repository<RefreshTokenEntity>,
  ) {
    this.repository = createTransactionAwareRepository(repository);
  }

  async create(data: CreateRefreshTokenData): Promise<RefreshTokenEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findByToken(token: string): Promise<RefreshTokenEntity | null> {
    return this.repository.findOne({
      where: { token },
      relations: { user: true },
    });
  }

  async findByUserId(userId: string): Promise<RefreshTokenEntity[]> {
    return this.repository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeToken(id: string, replacedByTokenId?: string): Promise<void> {
    await this.repository.update(id, {
      revokedAt: new Date(),
      replacedByTokenId,
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.repository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    await this.repository.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  async isTokenValid(token: string): Promise<boolean> {
    const entity = await this.findByToken(token);
    return entity ? entity.isValid : false;
  }
}
