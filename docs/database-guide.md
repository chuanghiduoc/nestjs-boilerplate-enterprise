# Database Guide

Guide for working with databases in NestJS Enterprise Boilerplate. Supports 3 ORMs: TypeORM, Prisma, and Mongoose.

## Table of Contents

1. [Overview](#overview)
2. [Database Selection](#database-selection)
3. [TypeORM (PostgreSQL)](#typeorm-postgresql)
4. [Prisma](#prisma)
5. [Mongoose (MongoDB)](#mongoose-mongodb)
6. [Repository Pattern](#repository-pattern)
7. [Transactions](#transactions)
8. [Switching Databases](#switching-databases)

---

## Overview

### Multi-Database Architecture

The project uses **Repository Pattern** with **Ports & Adapters** architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Domain Layer                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              IUserRepository                     │   │
│  │  (Interface - Database Agnostic)                 │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────┘
                            │ implements
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   TypeORM     │   │    Prisma     │   │   Mongoose    │
│  Repository   │   │  Repository   │   │  Repository   │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
   PostgreSQL          PostgreSQL           MongoDB
```

### Key Principles

1. **Domain does not depend on ORM** - Domain entities are pure TypeScript classes
2. **Repository interfaces defined in Domain layer** - Infrastructure implements them
3. **Switching database only requires changing environment variable**

---

## Database Selection

### Choose Database During Setup

```bash
yarn setup
```

Select one of three options:

- **TypeORM (PostgreSQL)** - Recommended for most projects
- **Prisma** - Modern ORM with great developer experience
- **Mongoose (MongoDB)** - Document database

### Environment Variable

```env
# TypeORM (PostgreSQL)
DB_TYPE=postgres

# Prisma
DB_TYPE=prisma

# Mongoose (MongoDB)
DB_TYPE=mongodb
```

### Cleanup Unused Adapters

```bash
# Remove unused database adapters
yarn cleanup:db
```

---

## TypeORM (PostgreSQL)

### Setup

```bash
# Install dependencies (already included)
yarn add typeorm @nestjs/typeorm pg

# Configure .env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=app_db
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

### Entity Definition

TypeORM entities are located in `src/infrastructure/persistence/typeorm/entities/`:

```typescript
// user.entity.ts
import { Entity, Column } from 'typeorm';
import { BaseTypeOrmEntity } from '../base/base-entity.typeorm';

@Entity('users')
export class UserEntity extends BaseTypeOrmEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;
}
```

### Migrations

```bash
# Generate migration from entity changes
yarn migration:generate src/infrastructure/persistence/typeorm/migrations/AddUserFields

# Run migrations
yarn migration:run

# Revert last migration
yarn migration:revert

# View migration status
yarn migration:show
```

**Migration file example:**

```typescript
// 1706300000000-InitialSchema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1706300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "email" varchar(255) UNIQUE NOT NULL,
        "password" varchar(255) NOT NULL,
        "first_name" varchar(100) NOT NULL,
        "last_name" varchar(100) NOT NULL,
        "status" varchar(50) DEFAULT 'PENDING',
        "tenant_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

### Repository Implementation

```typescript
// user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { User } from '@modules/user/domain/entities/user.entity';
import { IUserRepository } from '@modules/user/domain/repositories/user.repository.interface';

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const entity = this.toEntity(user);
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  // Mapper methods
  private toDomain(entity: UserEntity): User {
    return User.reconstitute(entity.id, {
      email: entity.email,
      password: entity.password,
      firstName: entity.firstName,
      lastName: entity.lastName,
      // ...
    });
  }

  private toEntity(user: User): Partial<UserEntity> {
    return {
      id: user.id,
      email: user.email.value,
      password: user.password.value,
      firstName: user.firstName,
      lastName: user.lastName,
      // ...
    };
  }
}
```

---

## Prisma

### Setup

```bash
# Install dependencies (already included)
yarn add @prisma/client
yarn add -D prisma

# Initialize Prisma
npx prisma init

# Configure .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/app_db
```

### Schema Definition

Prisma schema is located in `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String
  firstName     String    @map("first_name")
  lastName      String    @map("last_name")
  status        String    @default("PENDING")
  tenantId      String    @map("tenant_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  roles         UserRole[]
  refreshTokens RefreshToken[]

  @@map("users")
}

model Role {
  id          String    @id @default(uuid())
  name        String
  description String?
  permissions String[]
  tenantId    String    @map("tenant_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  users       UserRole[]

  @@unique([name, tenantId])
  @@map("roles")
}

model Tenant {
  id        String    @id @default(uuid())
  name      String    @unique
  slug      String    @unique
  status    String    @default("ACTIVE")
  settings  Json?
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  users User[]
  roles Role[]

  @@map("tenants")
}
```

### Migrations

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# Apply migrations (production)
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

### Repository Implementation

```typescript
// user.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User } from '@modules/user/domain/entities/user.entity';
import { IUserRepository } from '@modules/user/domain/repositories/user.repository.interface';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email },
    });
    return record ? this.toDomain(record) : null;
  }

  async save(user: User): Promise<User> {
    const data = this.toPersistence(user);
    const record = await this.prisma.user.upsert({
      where: { id: user.id },
      create: data,
      update: data,
    });
    return this.toDomain(record);
  }

  // Mapper methods...
}
```

---

## Mongoose (MongoDB)

### Setup

```bash
# Install dependencies (already included)
yarn add mongoose @nestjs/mongoose

# Configure .env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/app_db
```

### Schema Definition

Mongoose schemas are located in `src/infrastructure/persistence/mongoose/schemas/`:

```typescript
// user.schema.ts
import { createBaseSchema } from '../base/base-schema.mongoose';

export interface IUserDocument {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  status: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = createBaseSchema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    default: 'PENDING',
    enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'],
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ tenantId: 1, status: 1 });
```

### Repository Implementation

```typescript
// user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '@modules/user/domain/entities/user.entity';
import { IUserRepository } from '@modules/user/domain/repositories/user.repository.interface';
import { IUserDocument } from '../schemas/user.schema';

@Injectable()
export class MongooseUserRepository implements IUserRepository {
  constructor(
    @InjectModel('User')
    private readonly model: Model<IUserDocument>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.model.findOne({ email }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async save(user: User): Promise<User> {
    const data = this.toPersistence(user);
    const doc = await this.model
      .findByIdAndUpdate(user.id, { $set: data }, { upsert: true, new: true })
      .exec();
    return this.toDomain(doc);
  }

  // Mapper methods...
}
```

---

## Repository Pattern

### Domain Repository Interface

Defined in `src/modules/<module>/domain/repositories/`:

```typescript
// user.repository.interface.ts
import { IRepository } from '@core/domain/ports/repositories';
import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserFilterCriteria {
  email?: string;
  status?: string;
  tenantId?: string;
}

export interface IUserRepository extends IRepository<User, string, UserFilterCriteria> {
  findByEmail(email: string): Promise<User | null>;
  findByTenant(tenantId: string): Promise<User[]>;
}
```

### Base Repository Interface

```typescript
// repository.interface.ts
export interface IRepository<TEntity, TId, TFilter = Record<string, unknown>> {
  findById(id: TId): Promise<TEntity | null>;
  findOne(criteria: TFilter): Promise<TEntity | null>;
  findMany(
    criteria: TFilter,
    pagination?: PaginationParams,
    sort?: SortParams,
  ): Promise<PaginatedResult<TEntity>>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<boolean>;
  exists(criteria: TFilter): Promise<boolean>;
  count(criteria: TFilter): Promise<number>;
}
```

### Dependency Injection

Repositories are injected via tokens:

```typescript
// use-case.ts
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: CreateUserCommand): Promise<User> {
    // Domain doesn't know specific implementation
    const user = User.create({ ... });
    return this.userRepository.save(user);
  }
}
```

---

## Transactions

### Unit of Work Pattern

```typescript
// unit-of-work.interface.ts
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface IUnitOfWork {
  start(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  execute<T>(work: () => Promise<T>): Promise<T>;
}
```

### TypeORM Transaction

```typescript
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    return this.unitOfWork.execute(async () => {
      const order = Order.create({ ... });
      await this.orderRepository.save(order);

      // If error occurs, transaction will rollback
      await this.inventoryService.reserve(order.items);

      return order;
    });
  }
}
```

### Prisma Transaction

```typescript
// Prisma uses $transaction
async createOrder(data: CreateOrderDto) {
  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data });
    await tx.inventory.updateMany({ ... });
    return order;
  });
}
```

---

## Switching Databases

### Step 1: Change Environment Variable

```env
# From TypeORM to Prisma
# DB_TYPE=postgres
DB_TYPE=prisma
DATABASE_URL=postgresql://...
```

### Step 2: Run Setup (if needed)

```bash
# Generate Prisma client
npx prisma generate

# Sync schema
npx prisma db push
```

### Step 3: Restart Application

```bash
yarn start:dev
```

Database module automatically loads correct adapter based on `DB_TYPE`:

```typescript
// database.module.ts
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const dbType = process.env.DB_TYPE || 'postgres';

    switch (dbType) {
      case 'prisma':
        return PrismaDatabaseModule.forRootAsync();
      case 'mongodb':
        return MongooseDatabaseModule.forRootAsync();
      default:
        return TypeOrmDatabaseModule.forRootAsync();
    }
  }
}
```

---

## Best Practices

### 1. Always Use Repository Interface

```typescript
// Good
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: IUserRepository,
) {}

// Bad - coupled to implementation
constructor(
  private readonly userRepository: TypeOrmUserRepository,
) {}
```

### 2. Keep Domain Entities Pure

```typescript
// Domain entity - no ORM decorators
export class User extends AggregateRoot {
  private constructor(
    id: string,
    private _email: Email,
    private _password: Password,
  ) {
    super(id);
  }
}

// ORM entity - separate file
@Entity('users')
export class UserEntity extends BaseTypeOrmEntity {
  @Column()
  email: string;
}
```

### 3. Use Mappers

```typescript
// Mapper converts between domain and persistence
class UserMapper {
  toDomain(entity: UserEntity): User {
    return User.reconstitute(entity.id, { ... });
  }

  toPersistence(user: User): Partial<UserEntity> {
    return { ... };
  }
}
```

### 4. Index Important Fields

```typescript
// TypeORM
@Index(['email'])
@Index(['tenantId', 'status'])
@Entity('users')
export class UserEntity { }

// Prisma
@@index([tenantId, status])

// Mongoose
UserSchema.index({ tenantId: 1, status: 1 });
```
