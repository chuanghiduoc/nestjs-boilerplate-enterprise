import { createBaseSchema } from '../base/base-schema.mongoose';

/**
 * User Status Enum
 */
export enum MongoUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
}

/**
 * User Document Interface
 */
export interface IUserDocument {
  _id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  status: MongoUserStatus;
  emailVerified: boolean;
  tenantId?: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * User Schema for MongoDB
 *
 * Maps to the User domain entity.
 */
export const UserSchema = createBaseSchema({
  email: {
    type: String,
    required: true,
    unique: true, // unique already creates the index
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: Object.values(MongoUserStatus),
    default: MongoUserStatus.PENDING_VERIFICATION,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  tenantId: {
    type: String,
    index: true,
  },
  roles: [
    {
      type: String,
      ref: 'Role',
    },
  ],
});

// Indexes
UserSchema.index({ email: 1, tenantId: 1 });
UserSchema.index({ status: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function (this: IUserDocument) {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || '';
});
