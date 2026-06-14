<div align="center">

<img src=".github/assets/logo.svg" alt="NestJS Enterprise Boilerplate" width="700"/>

<br/>
<br/>

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

[![CI](https://img.shields.io/github/actions/workflow/status/chuanghiduoc/nestjs-boilerplate-enterprise/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/chuanghiduoc/nestjs-boilerplate-enterprise/actions)
[![Coverage](https://img.shields.io/codecov/c/github/chuanghiduoc/nestjs-boilerplate-enterprise?style=flat-square&label=Coverage)](https://codecov.io/gh/chuanghiduoc/nestjs-boilerplate-enterprise)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

<p align="center">
  <b>A production-ready NestJS boilerplate with Clean Architecture, designed for building scalable enterprise applications.</b>
</p>

[Getting Started](#-getting-started) •
[Features](#-features) •
[Documentation](#-documentation) •
[Contributing](#-contributing)

</div>

<br/>

<img src=".github/assets/divider.svg" alt="divider" width="100%"/>

<br/>

## Why This Boilerplate?

Building enterprise applications requires more than just a framework. You need a solid foundation with proper architecture, security, and scalability built-in from day one. This boilerplate provides:

- **Battle-tested architecture** following Clean Architecture and DDD principles
- **Flexible database layer** supporting PostgreSQL, MongoDB, with TypeORM, Prisma, or Mongoose
- **Security first** with JWT, OAuth2, RBAC, and comprehensive security hardening
- **Production ready** with Docker, Kubernetes configs, health checks, and observability

<br/>

## Features

### Core Architecture

- [x] **Clean Architecture** - Strict layer boundaries with dependency inversion
- [x] **Domain-Driven Design** - Rich domain models, aggregates, value objects
- [x] **CQRS Ready** - Command/Query separation when needed
- [x] **Event-Driven** - Domain events with async handlers
- [x] **Multi-Database** - Switch between ORMs with env variables

### Authentication & Security

- [x] **JWT Authentication** - Access & refresh token with rotation
- [x] **OAuth2 Social Login** - Google, Facebook, Apple integration
- [x] **RBAC** - Role-based access control
- [x] **Multi-Tenancy** - Full tenant isolation support
- [x] **Security Hardening** - Helmet, rate limiting, input sanitization

### Infrastructure

- [x] **Caching** - Redis with decorator-based caching
- [x] **Background Jobs** - Bull queue with processors
- [x] **File Storage** - S3 and local storage adapters
- [x] **Email** - SMTP with Handlebars templates
- [x] **WebSocket** - Real-time with Socket.io
- [x] **GraphQL** - Apollo Server integration

### Production Ready

- [x] **Health Checks** - Liveness, readiness, startup probes
- [x] **Graceful Shutdown** - Proper connection cleanup
- [x] **Structured Logging** - JSON logs with correlation ID
- [x] **Metrics** - Prometheus + OpenTelemetry tracing
- [x] **Docker** - Production Dockerfile & compose
- [x] **Kubernetes** - Deployment manifests included

<br/>

## Tech Stack

| Category          | Technologies                                    |
| ----------------- | ----------------------------------------------- |
| **Framework**     | NestJS 10.x, Node.js 20.x, TypeScript 5.x       |
| **Database**      | PostgreSQL, MongoDB (switchable via env)        |
| **ORM**           | TypeORM, Prisma, Mongoose (switchable via env)  |
| **Cache**         | Redis                                           |
| **Queue**         | Bull (Redis-based)                              |
| **API**           | REST, GraphQL (Apollo), WebSocket (Socket.io)   |
| **Auth**          | JWT, Passport, OAuth2 (Google, Facebook, Apple) |
| **Testing**       | Jest, Supertest                                 |
| **DevOps**        | Docker, Kubernetes, GitHub Actions              |
| **Observability** | Prometheus, OpenTelemetry, Structured Logging   |

<br/>

## Getting Started

### Prerequisites

| Requirement | Version             |
| ----------- | ------------------- |
| Node.js     | >= 20.x LTS         |
| Yarn        | >= 1.22.x           |
| PostgreSQL  | >= 14.x             |
| Redis       | >= 6.x _(optional)_ |

### Quick Install

```bash
# Clone the repository
git clone https://github.com/chuanghiduoc/nestjs-boilerplate-enterprise.git
cd nestjs-boilerplate-enterprise

# Install dependencies
yarn install

# Run interactive setup wizard
yarn setup

# Copy environment file
cp .env.example .env

# Run database migrations
yarn migration:run

# Start development server
yarn start:dev
```

Application will be available at `http://localhost:3000` (API base path: `http://localhost:3000/api/v1`).

Interactive Swagger docs (non-production only): `http://localhost:3000/docs`

### Using Docker

```bash
# Development with hot-reload
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

<br/>

<img src=".github/assets/divider.svg" alt="divider" width="100%"/>

<br/>

## Architecture

> **Clean Architecture + DDD + Hexagonal (Ports & Adapters)**

This boilerplate combines three complementary architectural patterns:

| Pattern                          | Purpose                     | Benefit                                           |
| -------------------------------- | --------------------------- | ------------------------------------------------- |
| **Clean Architecture**           | Layer organization          | Clear separation of concerns                      |
| **Hexagonal (Ports & Adapters)** | External system integration | **Swappable databases** (TypeORM/Prisma/Mongoose) |
| **Domain-Driven Design**         | Business logic modeling     | Rich domain models, ubiquitous language           |

### Layer Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                          │
│         Controllers • Resolvers • Gateways • DTOs                │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│           Use Cases • Commands • Queries • Handlers              │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Domain Layer (CORE)                           │
│       Entities • Value Objects • Aggregates • Domain Events      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PORTS (Interfaces)                     │   │
│  │   IUserRepository • ICacheService • IEmailService         │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  TypeORM        │  │  Prisma         │  │  Mongoose       │
│  Adapter        │  │  Adapter        │  │  Adapter        │
│  (PostgreSQL)   │  │  (PostgreSQL)   │  │  (MongoDB)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                    ADAPTERS (Implementations)
```

### How Database Switching Works

The **Hexagonal Architecture** enables runtime database switching via environment variables:

```bash
# PostgreSQL with TypeORM
DB_TYPE=postgres
DB_ORM=typeorm

# PostgreSQL with Prisma
DB_TYPE=postgres
DB_ORM=prisma

# MongoDB with Mongoose
DB_TYPE=mongodb
DB_ORM=mongoose
```

Domain layer defines **Ports** (interfaces), Infrastructure provides **Adapters** (implementations). Switch adapters without touching business logic.

| Layer              | Responsibility                               | Depends On         |
| ------------------ | -------------------------------------------- | ------------------ |
| **Presentation**   | HTTP handling, validation, serialization     | Application        |
| **Application**    | Use case orchestration, transactions         | Domain, Ports      |
| **Domain**         | Business rules, entities, ports (interfaces) | Nothing (Core)     |
| **Infrastructure** | Adapters implementing ports                  | Ports (implements) |

## Project Structure

```
src/
├── config/                    # Application configuration
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── auth.config.ts
│   └── ...
│
├── core/                      # Core domain (framework-agnostic)
│   ├── domain/
│   │   ├── base/              # Entity, ValueObject, AggregateRoot
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── events/
│   │   └── ports/             # Repository & Service interfaces
│   └── application/
│       ├── base/              # UseCase, Command, Query bases
│       └── use-cases/
│
├── infrastructure/            # Technical implementations
│   ├── persistence/
│   │   └── typeorm/           # TypeORM entities & repositories
│   ├── cache/                 # Redis caching
│   ├── email/                 # SMTP adapter
│   ├── messaging/             # Event bus
│   ├── jobs/                  # Background jobs (Bull)
│   └── ...
│
├── modules/                   # Feature modules (DDD Bounded Contexts)
│   ├── auth/
│   │   ├── application/       # Use cases
│   │   ├── domain/            # Entities, events
│   │   ├── infrastructure/    # Auth-specific adapters
│   │   └── presentation/      # Controllers, DTOs
│   ├── user/
│   ├── role/
│   └── tenant/
│
├── shared/                    # Cross-cutting concerns
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   └── utils/
│
└── main.ts                    # Application entry point
```

### Module Structure (DDD)

Each feature module follows this structure:

```
modules/{feature}/
├── application/
│   ├── commands/          # Write operations
│   ├── queries/           # Read operations
│   ├── use-cases/         # Business logic orchestration
│   └── event-handlers/    # Domain event handlers
├── domain/
│   ├── entities/          # Aggregate roots & entities
│   ├── value-objects/     # Immutable value types
│   ├── events/            # Domain events
│   └── repositories/      # Repository interfaces (ports)
├── infrastructure/        # Module-specific adapters
├── presentation/
│   ├── controllers/       # REST endpoints
│   ├── resolvers/         # GraphQL resolvers
│   └── dtos/              # Data transfer objects
└── {feature}.module.ts    # NestJS module definition
```

<br/>

<img src=".github/assets/divider.svg" alt="divider" width="100%"/>

<br/>

## Documentation

| Document                                       | Description                             |
| ---------------------------------------------- | --------------------------------------- |
| [Getting Started](./docs/getting-started.md)   | Installation, setup, and first steps    |
| [Architecture](./docs/architecture.md)         | System design, patterns, and layers     |
| [Database Guide](./docs/database-guide.md)     | TypeORM, Prisma, Mongoose configuration |
| [Module Generator](./docs/module-generator.md) | Creating modules with Hygen             |
| [API Guide](./docs/api-guide.md)               | REST, GraphQL, WebSocket APIs           |
| [Deployment](./docs/deployment.md)             | Docker, Kubernetes, CI/CD               |
| [Changelog](./CHANGELOG.md)                    | Notable changes and fixes               |

<br/>

## Scripts Reference

<details>
<summary><b>Development</b></summary>

```bash
yarn start:dev          # Start with hot-reload
yarn start:debug        # Start with debugger attached
yarn build              # Build for production
yarn start:prod         # Run production build
```

</details>

<details>
<summary><b>Code Generation</b></summary>

```bash
yarn generate:module    # Generate complete DDD module
yarn generate:entity    # Generate domain entity
yarn generate:usecase   # Generate use case
```

</details>

<details>
<summary><b>Database (TypeORM)</b></summary>

```bash
yarn migration:generate # Generate migration from entities
yarn migration:run      # Run pending migrations
yarn migration:revert   # Revert last migration
yarn db:seed            # Seed database
```

</details>

<details>
<summary><b>Database (Prisma)</b></summary>

```bash
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Create and run migrations
npx prisma studio       # Open Prisma Studio
```

</details>

<details>
<summary><b>Testing</b></summary>

```bash
yarn test               # Run unit tests
yarn test:watch         # Run tests in watch mode
yarn test:cov           # Generate coverage report
yarn test:e2e           # Run E2E tests
```

</details>

<details>
<summary><b>Code Quality</b></summary>

```bash
yarn lint               # ESLint check
yarn lint:fix           # ESLint fix
yarn format             # Prettier format
yarn type-check         # TypeScript check
```

</details>

<br/>

## API Overview

### Authentication Endpoints

| Method | Endpoint                | Description             |
| ------ | ----------------------- | ----------------------- |
| `POST` | `/api/v1/auth/register` | Register new user       |
| `POST` | `/api/v1/auth/login`    | Login with credentials  |
| `POST` | `/api/v1/auth/refresh`  | Refresh access token    |
| `POST` | `/api/v1/auth/logout`   | Logout and revoke token |
| `GET`  | `/api/v1/auth/google`   | Google OAuth login      |

### User Endpoints

| Method   | Endpoint            | Description            |
| -------- | ------------------- | ---------------------- |
| `GET`    | `/api/v1/users`     | List users (paginated) |
| `GET`    | `/api/v1/users/:id` | Get user by ID         |
| `POST`   | `/api/v1/users`     | Create user            |
| `PATCH`  | `/api/v1/users/:id` | Update user            |
| `DELETE` | `/api/v1/users/:id` | Delete user            |

### Health Endpoints

| Method | Endpoint                 | Description     |
| ------ | ------------------------ | --------------- |
| `GET`  | `/api/v1/health/live`    | Liveness probe  |
| `GET`  | `/api/v1/health/ready`   | Readiness probe |
| `GET`  | `/api/v1/health/startup` | Startup probe   |

<br/>

## Response Format

All API responses follow a consistent envelope format:

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

Error responses include detailed information:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "must be a valid email", "code": "isEmail" }],
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users",
    "requestId": "req_abc123"
  }
}
```

<br/>

<img src=".github/assets/divider.svg" alt="divider" width="100%"/>

<br/>

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user authentication
fix: resolve login redirect issue
docs: update API documentation
refactor: simplify user service
test: add unit tests for auth
chore: update dependencies
```

<br/>

## Support

- Create an [Issue](https://github.com/chuanghiduoc/nestjs-boilerplate-enterprise/issues) for bug reports
- Start a [Discussion](https://github.com/chuanghiduoc/nestjs-boilerplate-enterprise/discussions) for questions
- Read the [Documentation](./docs) for guides

<br/>

## License

This project is licensed under the [MIT License](LICENSE).

<br/>

<div align="center">

**Built with love for the NestJS community**

<br/>

<a href="https://nestjs.com/" target="_blank">
  <img src="https://img.shields.io/badge/Powered%20by-NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="Powered by NestJS"/>
</a>

</div>
