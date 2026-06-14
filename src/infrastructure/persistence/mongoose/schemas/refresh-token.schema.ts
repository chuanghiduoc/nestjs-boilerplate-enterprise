import { createBaseSchema } from '../base/base-schema.mongoose';

/**
 * Refresh Token Document Interface
 */
export interface IRefreshTokenDocument {
  _id: string;
  userId: string;
  token: string;
  familyId?: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  replacedByTokenId?: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Refresh Token Schema for MongoDB
 */
export const RefreshTokenSchema = createBaseSchema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true, // unique already creates the index
  },
  familyId: {
    type: String,
    index: true,
  },
  // Indexed via the TTL index declared below (RefreshTokenSchema.index).
  expiresAt: {
    type: Date,
    required: true,
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
  revokedAt: {
    type: Date,
  },
  revokedReason: {
    type: String,
  },
  replacedByTokenId: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  deviceId: {
    type: String,
  },
});

// Indexes
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
