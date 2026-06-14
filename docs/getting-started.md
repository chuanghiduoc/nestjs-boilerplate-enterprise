# Getting Started

Complete guide for installing and using NestJS Enterprise Boilerplate.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Project Setup](#project-setup)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [First API Request](#first-api-request)
7. [Next Steps](#next-steps)

---

## Prerequisites

### Required

| Software | Version     | Installation                        |
| -------- | ----------- | ----------------------------------- |
| Node.js  | >= 20.x LTS | [nodejs.org](https://nodejs.org/)   |
| Yarn     | >= 1.22.x   | `npm install -g yarn`               |
| Git      | Latest      | [git-scm.com](https://git-scm.com/) |

### Database (choose one)

| Database   | Version | Use Case                   |
| ---------- | ------- | -------------------------- |
| PostgreSQL | >= 14.x | Recommended for production |
| MongoDB    | >= 6.x  | Document-based storage     |
| SQLite     | -       | Development/testing only   |

### Optional

| Software       | Version | Purpose                       |
| -------------- | ------- | ----------------------------- |
| Redis          | >= 6.x  | Caching, sessions, queues     |
| Docker         | >= 20.x | Containerization              |
| Docker Compose | >= 2.x  | Multi-container orchestration |

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/chuanghiduoc/nestjs-boilerplate-enterprise.git
cd nestjs-boilerplate-enterprise
```

### 2. Install Dependencies

```bash
yarn install
```

> The project pins the package manager (`"packageManager": "yarn@1.22.22"`),
> so Corepack uses Yarn Classic and the committed `yarn.lock` stays in v1
> format. The Prisma client is generated automatically via a `postinstall`
> hook (`prisma generate`).

### 3. Run Setup Wizard

Interactive wizard to customize your project:

```bash
yarn setup
```

The wizard will ask you to choose:

1. **Database**: TypeORM (PostgreSQL), Prisma, or Mongoose (MongoDB)
2. **OAuth Providers**: Keep/remove Google, Facebook, Apple authentication
3. **Optional Features**: Keep/remove GraphQL, WebSocket, Jobs, i18n, Metrics, Email, Storage

### 4. Setup Environment

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration.

---

## Project Setup

### Using PostgreSQL (TypeORM - Recommended)

```bash
# 1. Create database
createdb app_db

# 2. Configure .env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=app_db
DB_USERNAME=postgres
DB_PASSWORD=your_password

# 3. Run migrations
yarn migration:run

# 4. (Optional) Seed data
yarn db:seed
```

### Using PostgreSQL (Prisma)

```bash
# 1. Configure .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/app_db

# 2. Generate Prisma Client
npx prisma generate

# 3. Run migrations
npx prisma migrate dev --name init

# 4. (Optional) Seed data
npx prisma db seed
```

### Using MongoDB (Mongoose)

```bash
# 1. Configure .env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/app_db

# 2. Start MongoDB
mongod --dbpath /path/to/data

# No migrations needed for MongoDB
```

### Using Docker

Fastest way to setup development environment:

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Run migrations
yarn migration:run

# Start application
yarn start:dev
```

**docker-compose.yml** includes:

- PostgreSQL 14
- Redis 6
- Adminer (Database UI)

---

## Configuration

### Environment Variables

The `.env.example` file contains all required environment variables:

```env
# ============================================
# APPLICATION
# ============================================
NODE_ENV=development
PORT=3000
APP_NAME=nestjs-app
API_PREFIX=api
# Numeric only — URI versioning prepends "v" (1 -> /api/v1)
API_VERSION=1

# ============================================
# DATABASE
# ============================================
# TypeORM/Prisma (PostgreSQL)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=app_db
DB_USERNAME=postgres
DB_PASSWORD=postgres
# DB_ORM=prisma  # optional: switch SQL ORM to Prisma (defaults to typeorm)
# DATABASE_URL is used by Prisma only
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db

# Mongoose (MongoDB)
# DB_TYPE=mongodb
# MONGODB_URI=mongodb://localhost:27017/app_db

# ============================================
# AUTHENTICATION
# ============================================
JWT_SECRET=change-this-in-production-use-long-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-this-refresh-secret-too
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# REDIS (Optional)
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ============================================
# OAUTH (Optional)
# ============================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback

# ============================================
# EMAIL (Optional)
# ============================================
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@example.com

# ============================================
# STORAGE (Optional)
# ============================================
STORAGE_TYPE=local
UPLOAD_DIR=./uploads

# S3 Configuration
# STORAGE_TYPE=s3
# AWS_S3_BUCKET=your-bucket
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1
```

### Config Modules

Configuration is organized in `src/config/`:

| File                 | Purpose                 |
| -------------------- | ----------------------- |
| `app.config.ts`      | Application settings    |
| `database.config.ts` | Database connection     |
| `auth.config.ts`     | Authentication settings |
| `jwt.config.ts`      | JWT configuration       |
| `cache.config.ts`    | Redis/cache settings    |
| `email.config.ts`    | SMTP configuration      |
| `storage.config.ts`  | File storage settings   |
| `throttle.config.ts` | Rate limiting           |
| `swagger.config.ts`  | API documentation       |

---

## Running the Application

### Development Mode

```bash
# With hot-reload
yarn start:dev

# With debugger (attach VS Code)
yarn start:debug
```

### Production Mode

```bash
# Build
yarn build

# Start
yarn start:prod
```

### Docker Mode

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

---

## First API Request

### 1. Health Check

Verify the application is running:

```bash
curl http://localhost:3000/api/v1/health/live
```

Response (wrapped in the standard envelope):

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "uptime": 123.45
  }
}
```

### 2. Register User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### 3. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### 4. Access Protected Endpoint

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 5. Swagger Documentation

Open your browser and navigate to (available in non-production environments):

```
http://localhost:3000/docs
```

---

## Next Steps

1. **[Database Guide](./database-guide.md)** - Learn how to work with databases
2. **[Module Generator](./module-generator.md)** - Create new modules with Hygen
3. **[API Guide](./api-guide.md)** - Learn about REST and GraphQL APIs
4. **[Architecture](./architecture.md)** - Understand Clean Architecture
5. **[Deployment](./deployment.md)** - Deploy to production

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Failed

1. Verify database is running
2. Check credentials in `.env`
3. Check network/firewall

```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d app_db
```

### Migration Failed

```bash
# View migration status
yarn migration:show

# Revert last migration
yarn migration:revert

# Generate new migration
yarn migration:generate
```

### Redis Connection Failed

1. Verify Redis is running
2. Check REDIS_HOST and REDIS_PORT in `.env`

```bash
# Test Redis connection
redis-cli ping
```

### TypeScript Errors

```bash
# Clear cache and rebuild
rm -rf dist node_modules/.cache
yarn build
```
