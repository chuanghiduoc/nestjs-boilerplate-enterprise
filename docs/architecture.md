# System Architecture

> **Architecture Style:** Clean Architecture + Modular Monolith
> **Primary Pattern:** Layered with Ports & Adapters
> **Framework:** NestJS (TypeScript)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Layer Definitions](#2-layer-definitions)
3. [Module Structure](#3-module-structure)
4. [Request Lifecycle](#4-request-lifecycle)
5. [Design Patterns](#5-design-patterns)
6. [Data Flow](#6-data-flow)
7. [Infrastructure Components](#7-infrastructure-components)
8. [Database Abstraction Strategy](#8-database-abstraction-strategy)
   - [8.1 Core Principles](#81-core-principles)
   - [8.2 Entity Separation](#82-entity-separation)
   - [8.3 Repository Contract](#83-repository-contract)
   - [8.4 Query Abstraction](#84-query-abstraction)
   - [8.5 Transaction Management](#85-transaction-management)
   - [8.6 Database Switching Guide](#86-database-switching-guide)
9. [Folder Structure](#9-folder-structure)
10. [Naming Conventions](#10-naming-conventions)
11. [API Response Standards](#11-api-response-standards)
    - [11.1 Response Envelope](#111-response-envelope)
    - [11.2 Success Response](#112-success-response)
    - [11.3 Error Response](#113-error-response)
    - [11.4 Error Response Examples](#114-error-response-examples)
    - [11.5 HTTP Status Code Mapping](#115-http-status-code-mapping)
    - [11.6 Error Code Registry](#116-error-code-registry)
    - [11.7 Response Headers](#117-response-headers)
    - [11.8 Pagination Standards](#118-pagination-standards)
    - [11.9 Response Rules](#119-response-rules)
    - [11.10 DTO Validation Examples](#1110-dto-validation-examples)
12. [Production Readiness](#12-production-readiness)
    - [12.1 Resilience Patterns](#121-resilience-patterns)
    - [12.2 Graceful Shutdown](#122-graceful-shutdown)
    - [12.3 Health Checks](#123-health-checks)
    - [12.4 Caching Strategy](#124-caching-strategy)
    - [12.5 Security Hardening](#125-security-hardening)
    - [12.6 Database Operations](#126-database-operations)
    - [12.7 Observability Details](#127-observability-details)
    - [12.8 Deployment Strategy](#128-deployment-strategy)
    - [12.9 Production Checklist](#129-production-checklist)
13. [Architecture Decision Records](#13-architecture-decision-records)

---

## 1. Architecture Overview

### 1.1 Architecture Principles

| Principle                 | Description                                  | Enforcement                                         |
| ------------------------- | -------------------------------------------- | --------------------------------------------------- |
| **Dependency Rule**       | Inner layers MUST NOT depend on outer layers | Domain has zero external imports                    |
| **Dependency Inversion**  | High-level modules depend on abstractions    | All repositories accessed via interfaces            |
| **Single Responsibility** | Each module has one reason to change         | Max 5 services per module                           |
| **Interface Segregation** | Clients depend only on interfaces they use   | Granular port definitions                           |
| **Explicit Dependencies** | All dependencies injected via constructor    | No service locator pattern                          |
| **Anti-Corruption Layer** | Isolate external systems from domain         | Adapters translate external models to domain models |

### 1.2 System Layers (Outside → Inside)

| Layer              | Responsibility                                 | Depends On         | Examples                               |
| ------------------ | ---------------------------------------------- | ------------------ | -------------------------------------- |
| **Presentation**   | HTTP handling, input validation, serialization | Application        | Controllers, Resolvers, Gateways       |
| **Application**    | Use case orchestration, transactions           | Domain, Ports      | UseCases, Commands, Queries, Handlers  |
| **Domain**         | Business rules, entities, domain events        | Nothing            | Entities, ValueObjects, DomainServices |
| **Infrastructure** | External systems, persistence, messaging       | Ports (implements) | Repositories, Adapters, External APIs  |

### 1.3 Boundary Rules

| From Layer     | Can Access                    | Cannot Access                   |
| -------------- | ----------------------------- | ------------------------------- |
| Presentation   | Application (via UseCases)    | Domain directly, Infrastructure |
| Application    | Domain, Ports (interfaces)    | Infrastructure implementations  |
| Domain         | Nothing external              | Any other layer                 |
| Infrastructure | Ports (implements interfaces) | Application, Presentation       |

---

## 2. Layer Definitions

### 2.1 Presentation Layer

**Purpose:** Handle external communication protocols and transform data.

| Component       | Responsibility        | Input                  | Output           |
| --------------- | --------------------- | ---------------------- | ---------------- |
| **Controllers** | REST API endpoints    | HTTP Request           | HTTP Response    |
| **Resolvers**   | GraphQL operations    | GraphQL Query/Mutation | GraphQL Response |
| **Gateways**    | WebSocket events      | Socket Event           | Socket Emit      |
| **DTOs**        | Data shape validation | Raw input              | Validated object |

**Rules:**

- No business logic
- No direct database access
- No domain entity exposure (use DTOs)
- Validation only for shape/format, not business rules

**Validation Layer Details:**

| Layer                     | Validation Type | Responsibility                       | Examples                                     |
| ------------------------- | --------------- | ------------------------------------ | -------------------------------------------- |
| **Presentation (DTO)**    | Syntactic       | Format, shape, type                  | `@IsEmail()`, `@IsUUID()`, `@MaxLength(100)` |
| **Application (UseCase)** | Semantic        | Existence, uniqueness, authorization | User exists?, Email unique?, Can access?     |
| **Domain (Entity)**       | Invariant       | Business rules, state consistency    | Balance >= 0, Valid status transition        |
| **Database**              | Constraint      | Data integrity                       | NOT NULL, UNIQUE, CHECK, FK                  |

**Input Sanitization Rules:**

| Rule                | Purpose                  | Implementation                             |
| ------------------- | ------------------------ | ------------------------------------------ |
| Trim whitespace     | Clean input              | `@Transform(({ value }) => value?.trim())` |
| XSS filtering       | Prevent script injection | `sanitize-html` for rich text fields       |
| SQL escaping        | Prevent injection        | Handled by ORM (parameterized queries)     |
| Path traversal      | Prevent file access      | Validate no `../` in file paths            |
| Null byte injection | Prevent bypass           | Strip `\0` characters                      |

### 2.2 Application Layer

**Purpose:** Orchestrate use cases and coordinate domain objects.

| Component              | Responsibility            | When to Use                |
| ---------------------- | ------------------------- | -------------------------- |
| **UseCase**            | Single business operation | One action = one use case  |
| **Command**            | Write operation intent    | Create, Update, Delete     |
| **Query**              | Read operation intent     | Fetch, Search, List        |
| **Handler**            | Process commands/queries  | CQRS implementation        |
| **ApplicationService** | Complex orchestration     | Multi-aggregate operations |

**Rules:**

- One public method per use case class
- Transaction boundary owner
- No HTTP/framework concepts
- Emit domain events after successful operations

### 2.3 Domain Layer

**Purpose:** Encapsulate core business rules and invariants.

| Component         | Responsibility                  | Characteristics              |
| ----------------- | ------------------------------- | ---------------------------- |
| **Entity**        | Identity + lifecycle + behavior | Has unique ID, mutable state |
| **ValueObject**   | Immutable descriptive object    | No ID, equality by value     |
| **Aggregate**     | Consistency boundary            | Single transaction scope     |
| **AggregateRoot** | Entry point to aggregate        | Controls access to children  |
| **DomainService** | Cross-entity business logic     | Stateless, pure functions    |
| **DomainEvent**   | Record of something happened    | Immutable, past tense named  |

**Rules:**

- Zero external dependencies (no imports from other layers)
- No framework annotations on domain objects
- All invariants enforced in domain
- Rich domain model (behavior + data)

### 2.4 Infrastructure Layer

**Purpose:** Implement technical concerns and external integrations.

| Component          | Responsibility                | Implements                 |
| ------------------ | ----------------------------- | -------------------------- |
| **Repository**     | Data persistence              | `IRepository<T>` port      |
| **Adapter**        | External service integration  | Service-specific port      |
| **EventPublisher** | Dispatch domain events        | `IEventPublisher` port     |
| **Mapper**         | Entity ↔ ORM model conversion | Internal to infrastructure |

**Rules:**

- Only implements interfaces defined in Domain/Application
- Framework-specific code isolated here
- Can be swapped without affecting business logic

---

## 3. Module Structure

### 3.1 Core Modules (Global)

| Module             | Scope  | Responsibility               | Exports                       |
| ------------------ | ------ | ---------------------------- | ----------------------------- |
| **ConfigModule**   | Global | Environment configuration    | `ConfigService`               |
| **DatabaseModule** | Global | Database connection, pooling | `DataSource`, `EntityManager` |
| **CacheModule**    | Global | Caching strategy             | `CacheService`                |
| **LoggerModule**   | Global | Structured logging           | `LoggerService`               |
| **EventBusModule** | Global | Domain event dispatching     | `EventBus`                    |

### 3.2 Feature Modules

| Module           | Dependencies | Bounded Context                |
| ---------------- | ------------ | ------------------------------ |
| **AuthModule**   | -            | Authentication & Authorization |
| **UserModule**   | -            | User management                |
| **RoleModule**   | -            | RBAC management                |
| **TenantModule** | -            | Multi-tenancy                  |

### 3.3 Infrastructure and Runtime Modules

| Module                  | Runtime    | Responsibility                                 |
| ----------------------- | ---------- | ---------------------------------------------- |
| **JobsModule**          | All        | Bull connection, queues, and producer services |
| **JobProcessorsModule** | Worker     | Email, notification, and cleanup consumers     |
| **JobSchedulersModule** | Scheduler  | Cron registration and scheduled job producers  |
| **EmailModule**         | API/Worker | SMTP adapter and templates                     |
| **StorageModule**       | API        | Local or S3 file storage                       |
| **WebSocketModule**     | API        | Socket.io gateway and Redis event subscriber   |
| **AuditModule**         | API        | Audit logging                                  |

### 3.4 Runtime Boundaries

| Runtime   | Root module       | Owns                                           | Must not own          |
| --------- | ----------------- | ---------------------------------------------- | --------------------- |
| API       | `AppModule`       | HTTP, GraphQL, WebSocket, queue producers      | Bull processors, cron |
| Worker    | `WorkerModule`    | Bull processors, database/cache/email adapters | HTTP listeners, cron  |
| Scheduler | `SchedulerModule` | Cron providers and cleanup queue producers     | HTTP, job consumption |

API and workers may scale independently. The scheduler is deployed as exactly one replica.
Worker-originated in-app notifications use Redis Pub/Sub so every API replica can deliver
the event to sockets connected locally.

### 3.5 Module Dependency Rules

| Rule                                  | Description                                 |
| ------------------------------------- | ------------------------------------------- |
| **No circular dependencies**          | Module A → B means B cannot → A             |
| **Feature modules are isolated**      | Communicate via events or shared interfaces |
| **Shared modules are stateless**      | No business state, only utilities           |
| **Core modules have no dependencies** | Only framework dependencies                 |

---

## 4. Request Lifecycle

### 4.1 HTTP Request Pipeline

| Order | Component                 | Purpose                        | Examples                          |
| ----- | ------------------------- | ------------------------------ | --------------------------------- |
| 1     | **Middleware**            | Cross-cutting concerns         | Helmet, CORS, Compression         |
| 2     | **Guards**                | Authentication & Authorization | `JwtAuthGuard`, `RolesGuard`      |
| 3     | **Interceptors (Before)** | Request transformation         | Logging, Timeout                  |
| 4     | **Pipes**                 | Validation & Transformation    | `ValidationPipe`, `ParseUUIDPipe` |
| 5     | **Controller**            | Route handling                 | Extract params, call use case     |
| 6     | **UseCase**               | Business logic execution       | Process command/query             |
| 7     | **Repository**            | Data access                    | Query/persist data                |
| 8     | **Interceptors (After)**  | Response transformation        | Serialization, Caching            |
| 9     | **Exception Filter**      | Error handling                 | Format error response             |

### 4.2 Guards Execution Order

| Order | Guard              | Purpose                  |
| ----- | ------------------ | ------------------------ |
| 1     | `ThrottlerGuard`   | Rate limiting            |
| 2     | `JwtAuthGuard`     | Token validation         |
| 3     | `RolesGuard`       | Role-based access        |
| 4     | `PermissionsGuard` | Fine-grained permissions |
| 5     | `TenantGuard`      | Tenant isolation         |

### 4.3 Error Handling Flow

| Exception Type                  | Handler            | HTTP Status | Response Format                     |
| ------------------------------- | ------------------ | ----------- | ----------------------------------- |
| `ValidationException`           | `ValidationFilter` | 400         | `{ errors: [...] }`                 |
| `UnauthorizedException`         | `AuthFilter`       | 401         | `{ message: "..." }`                |
| `ForbiddenException`            | `AuthFilter`       | 403         | `{ message: "..." }`                |
| `NotFoundException`             | `NotFoundFilter`   | 404         | `{ message: "..." }`                |
| `ConflictException`             | `ConflictFilter`   | 409         | `{ code: "...", message: "..." }`   |
| `PayloadTooLargeException`      | `PayloadFilter`    | 413         | `{ message: "..." }`                |
| `UnsupportedMediaTypeException` | `MediaTypeFilter`  | 415         | `{ message: "..." }`                |
| `DomainException`               | `DomainFilter`     | 422         | `{ code: "...", message: "..." }`   |
| `RateLimitException`            | `RateLimitFilter`  | 429         | `{ message: "...", retryAfter: N }` |
| `Error` (unhandled)             | `GlobalFilter`     | 500         | `{ message: "Internal error" }`     |
| `ServiceUnavailableException`   | `ServiceFilter`    | 503         | `{ message: "..." }`                |
| `GatewayTimeoutException`       | `TimeoutFilter`    | 504         | `{ message: "..." }`                |

---

## 5. Design Patterns

### 5.1 Required Patterns

| Pattern                  | Purpose                 | Implementation Location       |
| ------------------------ | ----------------------- | ----------------------------- |
| **Repository**           | Abstract data access    | `domain/ports/repositories/`  |
| **Dependency Injection** | Loose coupling          | NestJS IoC container          |
| **Factory**              | Complex entity creation | `domain/factories/`           |
| **Unit of Work**         | Transaction management  | `infrastructure/persistence/` |
| **DTO**                  | Data transfer           | `presentation/dtos/`          |
| **Mapper**               | Object transformation   | `infrastructure/mappers/`     |

### 5.2 Optional Patterns (Use When Needed)

| Pattern            | When to Use                            | Complexity Cost |
| ------------------ | -------------------------------------- | --------------- |
| **CQRS**           | Read/Write models differ significantly | High            |
| **Event Sourcing** | Need complete audit trail              | Very High       |
| **Saga**           | Distributed transactions               | High            |
| **Specification**  | Complex query composition              | Medium          |
| **Strategy**       | Multiple algorithm variants            | Low             |
| **Decorator**      | Add behavior dynamically               | Low             |

### 5.3 Anti-Patterns to Avoid

| Anti-Pattern              | Problem                                   | Solution                  |
| ------------------------- | ----------------------------------------- | ------------------------- |
| **Anemic Domain Model**   | Logic in services, entities are just data | Put behavior in entities  |
| **God Module**            | Module with too many responsibilities     | Split by bounded context  |
| **Service Locator**       | Hidden dependencies                       | Use constructor injection |
| **Circular Dependencies** | Tight coupling, hard to test              | Use events or interfaces  |
| **Primitive Obsession**   | Using primitives for domain concepts      | Create Value Objects      |

---

## 6. Data Flow

### 6.1 Command Flow (Write Operations)

| Step | Component      | Action                               |
| ---- | -------------- | ------------------------------------ |
| 1    | Controller     | Receive request, validate DTO        |
| 2    | Controller     | Create Command object                |
| 3    | CommandHandler | Load aggregate from repository       |
| 4    | Aggregate      | Execute business logic, raise events |
| 5    | Repository     | Persist aggregate                    |
| 6    | EventBus       | Publish domain events                |
| 7    | EventHandlers  | Handle side effects (async)          |

### 6.2 Query Flow (Read Operations)

| Step | Component    | Action                           |
| ---- | ------------ | -------------------------------- |
| 1    | Controller   | Receive request, validate params |
| 2    | Controller   | Create Query object              |
| 3    | QueryHandler | Call read repository/cache       |
| 4    | Repository   | Fetch data (optimized for reads) |
| 5    | Mapper       | Transform to response DTO        |
| 6    | Controller   | Return response                  |

### 6.3 Event Flow

| Step | Component     | Action                        |
| ---- | ------------- | ----------------------------- |
| 1    | Aggregate     | Raise `DomainEvent`           |
| 2    | Repository    | Collect events on save        |
| 3    | UnitOfWork    | Commit transaction            |
| 4    | EventBus      | Dispatch events (post-commit) |
| 5    | EventHandlers | Process events async          |

---

## 7. Infrastructure Components

### 7.1 Data Storage

| Component            | Purpose                  | Technology Options         |
| -------------------- | ------------------------ | -------------------------- |
| **Primary Database** | Transactional data       | PostgreSQL (recommended)   |
| **Read Replica**     | Read scaling             | PostgreSQL replica         |
| **Cache**            | Performance optimization | Redis                      |
| **Search Engine**    | Full-text search         | Elasticsearch, MeiliSearch |
| **File Storage**     | Binary assets            | S3, GCS, MinIO             |

### 7.2 Messaging

| Component            | Purpose               | Technology Options          |
| -------------------- | --------------------- | --------------------------- |
| **Job Queue**        | Async job processing  | Bull backed by Redis        |
| **Domain Event Bus** | Module event dispatch | In-process handlers         |
| **Realtime Bridge**  | Worker-to-API fan-out | Redis Pub/Sub and WebSocket |

### 7.3 Observability

| Component         | Purpose                | Technology Options    |
| ----------------- | ---------------------- | --------------------- |
| **Logging**       | Structured logs        | Winston, Pino         |
| **Metrics**       | Performance monitoring | Prometheus, DataDog   |
| **Tracing**       | Distributed tracing    | OpenTelemetry, Jaeger |
| **Health Checks** | Service health         | Terminus              |

### 7.4 Security

| Component            | Purpose               | Implementation  |
| -------------------- | --------------------- | --------------- |
| **Authentication**   | Identity verification | JWT, OAuth2     |
| **Authorization**    | Access control        | RBAC, ABAC      |
| **Rate Limiting**    | Abuse prevention      | ThrottlerModule |
| **Input Validation** | Injection prevention  | class-validator |
| **Encryption**       | Data protection       | bcrypt, AES-256 |

---

## 8. Database Abstraction Strategy

> **Goal:** Enable switching between databases (PostgreSQL ↔ MySQL, SQL ↔ NoSQL) or ORMs (TypeORM ↔ Prisma ↔ Mongoose) with minimal impact on business logic.

### 8.1 Core Principles

| Principle                   | Description                                                              | Enforcement                                                   |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Domain Ignorance**        | Domain layer has ZERO knowledge of persistence technology                | No ORM imports/annotations in `core/domain/`                  |
| **Contract-First**          | Repository interfaces define the contract, not implementations           | All persistence access via `IRepository` ports                |
| **Mapper Isolation**        | ORM entities ↔ Domain entities conversion happens in Infrastructure only | Mappers live in `infrastructure/persistence/mappers/`         |
| **Technology Containment**  | Database-specific code NEVER leaks beyond Infrastructure layer           | Query builders, decorators, schemas stay in `infrastructure/` |
| **Abstracted Transactions** | Transaction management via interface, not ORM-specific APIs              | Use `IUnitOfWork` pattern                                     |

**Dependency Direction:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Domain Layer                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Domain       │    │ IRepository  │    │ IUnitOfWork  │       │
│  │ Entities     │    │ (Port)       │    │ (Port)       │       │
│  └──────────────┘    └──────▲───────┘    └──────▲───────┘       │
│        ▲                    │                   │               │
│        │ uses               │ defines          │ defines       │
│        │                    │                   │               │
└────────┼────────────────────┼───────────────────┼───────────────┘
         │                    │                   │
         │                    │ implements        │ implements
         │                    │                   │
┌────────┼────────────────────┼───────────────────┼───────────────┐
│        │           Infrastructure Layer         │               │
│  ┌─────┴──────┐    ┌───────┴───────┐    ┌──────┴───────┐       │
│  │ Mapper     │◄───│ Repository    │    │ UnitOfWork   │       │
│  │            │    │ (TypeORM)     │    │ (TypeORM)    │       │
│  └─────┬──────┘    └───────────────┘    └──────────────┘       │
│        │                                                        │
│        ▼                                                        │
│  ┌──────────────┐                                               │
│  │ ORM Entity   │  ← Has decorators, DB-specific annotations    │
│  │ (TypeORM)    │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8.2 Entity Separation

**Rule:** Domain Entity and ORM Entity MUST be completely separated.

| Aspect           | Domain Entity              | ORM Entity                                   |
| ---------------- | -------------------------- | -------------------------------------------- |
| **Location**     | `core/domain/entities/`    | `infrastructure/persistence/[orm]/entities/` |
| **Purpose**      | Business logic, invariants | Database mapping, persistence                |
| **Dependencies** | None (pure TypeScript)     | ORM decorators, DB-specific types            |
| **Behavior**     | Rich model with methods    | Data container (anemic)                      |
| **Identity**     | Domain ID (Value Object)   | Database primary key                         |
| **Validation**   | Business rules             | Schema constraints                           |

**Why Separation Matters:**

| Scenario                | Without Separation                    | With Separation                     |
| ----------------------- | ------------------------------------- | ----------------------------------- |
| Switch ORM              | Rewrite all entities + business logic | Only rewrite ORM entities + mappers |
| Add DB-specific feature | Pollutes domain with DB concerns      | Contained in infrastructure         |
| Unit testing domain     | Needs ORM/DB mocking                  | Pure unit tests, no mocking         |
| Schema changes          | Risk breaking business logic          | Only affects mapper + ORM entity    |

**Mapping Flow:**

```
[Database] ←→ [ORM Entity] ←→ [Mapper] ←→ [Domain Entity] ←→ [Application Layer]
              Infrastructure          │          Domain
                                      │
                          Boundary (Mapper handles conversion)
```

**Mapper Responsibilities:**

| Direction   | Mapper Method                 | Handles                                 |
| ----------- | ----------------------------- | --------------------------------------- |
| DB → Domain | `toDomain(ormEntity)`         | Reconstruct domain entity with behavior |
| Domain → DB | `toPersistence(domainEntity)` | Extract data for storage                |
| Collection  | `toDomainList(ormEntities)`   | Batch conversion with optimization      |

---

### 8.3 Repository Contract

**Base Repository Interface Design:**

| Method               | Purpose                   | Database-Agnostic Consideration             |
| -------------------- | ------------------------- | ------------------------------------------- |
| `findById(id)`       | Single entity lookup      | ID format abstracted (UUID, ObjectId, etc.) |
| `findOne(criteria)`  | Single entity by criteria | Criteria object, not raw query              |
| `findMany(criteria)` | Multiple entities         | Criteria + pagination abstraction           |
| `save(entity)`       | Insert or update          | Upsert logic handled by implementation      |
| `delete(id)`         | Remove entity             | Soft vs hard delete configurable            |
| `exists(criteria)`   | Check existence           | Optimized count query                       |

**Criteria/Filter Abstraction:**

| Approach                  | Pros                            | Cons                  | When to Use                       |
| ------------------------- | ------------------------------- | --------------------- | --------------------------------- |
| **Specification Pattern** | Type-safe, composable, testable | More boilerplate      | Complex queries, reusable filters |
| **Criteria Object**       | Simple, flexible                | Less type-safe        | Simple CRUD operations            |
| **Query Object**          | Full control                    | DB-specific leak risk | Read-optimized queries (CQRS)     |

**Specification Pattern Benefits:**

| Benefit             | Description                                    |
| ------------------- | ---------------------------------------------- |
| **Composability**   | `spec1.and(spec2).or(spec3)`                   |
| **Reusability**     | Same spec works across different repositories  |
| **Testability**     | Test business rules without database           |
| **DB Independence** | Each implementation translates to native query |

**Pagination Abstraction:**

| Concern          | Abstracted Interface                 | SQL Implementation  | MongoDB Implementation     |
| ---------------- | ------------------------------------ | ------------------- | -------------------------- |
| **Offset-based** | `{ page, limit }`                    | `OFFSET/LIMIT`      | `skip/limit`               |
| **Cursor-based** | `{ cursor, limit, direction }`       | `WHERE id > cursor` | `{ _id: { $gt: cursor } }` |
| **Result**       | `{ data, meta: { total, hasNext } }` | COUNT + SELECT      | `countDocuments` + `find`  |

---

### 8.4 Query Abstraction

**Read vs Write Model Separation (CQRS consideration):**

| Operation            | Interface                     | Flexibility                       |
| -------------------- | ----------------------------- | --------------------------------- |
| **Commands (Write)** | Strict repository interface   | Must go through domain            |
| **Queries (Read)**   | Can use optimized read models | May bypass domain for performance |

**Query Complexity Levels:**

| Level         | Approach                          | Database Independence                         |
| ------------- | --------------------------------- | --------------------------------------------- |
| **Simple**    | Repository methods with criteria  | ✅ High - fully abstracted                    |
| **Medium**    | Specification pattern             | ✅ High - spec translates per DB              |
| **Complex**   | Query objects / Read repositories | ⚠️ Medium - may need DB-specific optimization |
| **Analytics** | Raw queries / Views               | ❌ Low - usually DB-specific                  |

**Handling DB-Specific Features:**

| Feature                | Abstraction Strategy                                |
| ---------------------- | --------------------------------------------------- |
| **Full-text search**   | `ISearchRepository` interface, implementations vary |
| **Geospatial queries** | `IGeoRepository` with abstracted geo types          |
| **JSON queries**       | Criteria object with JSON path abstraction          |
| **Aggregations**       | Dedicated `IAnalyticsRepository` per use case       |

**When Raw Queries Are Acceptable:**

| Scenario             | Guideline                                             |
| -------------------- | ----------------------------------------------------- |
| Complex reports      | Isolate in `ReadRepository`, document DB dependency   |
| Performance-critical | Profile first, optimize with specific query if needed |
| DB-specific features | Create feature-specific port interface                |

---

### 8.5 Transaction Management

**Unit of Work Pattern:**

| Responsibility            | Description                                    |
| ------------------------- | ---------------------------------------------- |
| **Track changes**         | Know which entities are new, modified, deleted |
| **Atomic commit**         | All changes succeed or all fail                |
| **Event collection**      | Gather domain events for post-commit dispatch  |
| **Connection management** | Handle connection/session lifecycle            |

**Transaction Boundary Rules:**

| Rule                                | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| **UseCase owns transaction**        | Transaction starts/ends in Application layer        |
| **Repository is transaction-aware** | Repository participates in active transaction       |
| **Domain is transaction-ignorant**  | Domain never knows about transactions               |
| **Events dispatch post-commit**     | Domain events only dispatch after successful commit |

**Cross-Database Transaction Handling:**

| Scenario                 | Strategy                               |
| ------------------------ | -------------------------------------- |
| **Single database**      | Native transaction via UnitOfWork      |
| **Multiple databases**   | Saga pattern with compensating actions |
| **Eventual consistency** | Domain events + idempotent handlers    |

**Nested Transaction Behavior:**

| Behavior        | Implementation                                           |
| --------------- | -------------------------------------------------------- |
| **Savepoints**  | For SQL databases, create savepoint on nested call       |
| **Propagation** | Join existing transaction if available                   |
| **Isolation**   | Configurable per use case (read committed, serializable) |

---

### 8.6 Database Switching Guide

**Environment-Based Database Selection:**

This project supports dynamic database switching via environment variables:

| Variable  | Options                         | Default    | Description          |
| --------- | ------------------------------- | ---------- | -------------------- |
| `DB_TYPE` | `postgres`, `mongodb`           | `postgres` | Database engine type |
| `DB_ORM`  | `typeorm`, `prisma`, `mongoose` | `typeorm`  | ORM/ODM framework    |

**Configuration Examples:**

```env
# TypeORM with PostgreSQL (Default)
DB_TYPE=postgres
DB_ORM=typeorm
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=app_db

# Prisma with PostgreSQL
DB_TYPE=prisma
DATABASE_URL=postgresql://postgres:password@localhost:5432/app_db

# Mongoose with MongoDB
DB_TYPE=mongodb
DB_ORM=mongoose
MONGODB_URI=mongodb://localhost:27017/app_db
```

**Database Module Auto-Loading:**

The `DatabaseModule` automatically loads the appropriate adapter based on environment variables:

```typescript
// database.module.ts
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const dbType = process.env.DB_TYPE || 'postgres';
    const dbOrm = process.env.DB_ORM || 'typeorm';

    if (dbType === 'prisma' || dbOrm === 'prisma') {
      return PrismaModule.forRootAsync();
    }
    if (dbType === 'mongodb' || dbOrm === 'mongoose') {
      return MongooseModule.forRootAsync();
    }
    return TypeOrmModule.forRootAsync();
  }
}
```

---

**Switching Effort Matrix:**

| From → To                 | Effort    | What Changes                                            | What Stays                        |
| ------------------------- | --------- | ------------------------------------------------------- | --------------------------------- |
| **PostgreSQL → MySQL**    | 🟢 Low    | Connection config, some SQL syntax                      | Everything else                   |
| **PostgreSQL → MariaDB**  | 🟢 Low    | Connection config                                       | Everything else                   |
| **TypeORM → Prisma**      | 🟡 Medium | ORM entities, repositories, mappers                     | Domain, Application, Presentation |
| **PostgreSQL → MongoDB**  | 🟡 Medium | ORM entities, repositories, mappers, some queries       | Domain, Application, Presentation |
| **SQL → Different NoSQL** | 🔴 High   | Infrastructure layer, possibly some application queries | Domain layer                      |

**Step-by-Step Migration Process:**

| Step | Action                                                    | Validates            |
| ---- | --------------------------------------------------------- | -------------------- |
| 1    | Create new `infrastructure/persistence/[new-orm]/` folder | Folder structure     |
| 2    | Implement ORM entities for new database                   | Schema mapping       |
| 3    | Implement mappers (ORM Entity ↔ Domain Entity)            | Data conversion      |
| 4    | Implement repository interfaces                           | Contract compliance  |
| 5    | Implement UnitOfWork                                      | Transaction handling |
| 6    | Update DI bindings in module                              | Wiring               |
| 7    | Run integration tests                                     | Functionality        |
| 8    | Run performance tests                                     | Performance parity   |

**What MUST NOT Change During Migration:**

| Layer            | Components                                              | Reason                                              |
| ---------------- | ------------------------------------------------------- | --------------------------------------------------- |
| **Domain**       | Entities, Value Objects, Domain Services, Domain Events | Core business logic is DB-independent               |
| **Application**  | UseCases, Commands, Queries, Handlers                   | Orchestration depends on ports, not implementations |
| **Presentation** | Controllers, DTOs, Resolvers                            | HTTP/GraphQL layer unchanged                        |
| **Ports**        | Repository interfaces, UnitOfWork interface             | Contracts remain stable                             |

**What WILL Change During Migration:**

| Component    | Location                                           | Changes Required                    |
| ------------ | -------------------------------------------------- | ----------------------------------- |
| ORM Entities | `infrastructure/persistence/[orm]/entities/`       | Complete rewrite                    |
| Repositories | `infrastructure/persistence/[orm]/repositories/`   | Complete rewrite                    |
| Mappers      | `infrastructure/persistence/mappers/`              | Update for new ORM entity structure |
| UnitOfWork   | `infrastructure/persistence/[orm]/unit-of-work.ts` | Complete rewrite                    |
| Migrations   | `infrastructure/persistence/[orm]/migrations/`     | New migration system                |
| Config       | `config/database.config.ts`                        | Connection parameters               |

**Migration Validation Checklist:**

| Check                        | Method                        | Pass Criteria                  |
| ---------------------------- | ----------------------------- | ------------------------------ |
| All repository methods work  | Integration tests             | 100% pass                      |
| Transaction rollback works   | Test with intentional failure | Data unchanged on failure      |
| Pagination works correctly   | Test edge cases               | Consistent results             |
| Domain events still dispatch | Test event flow               | Events fire post-commit        |
| Performance acceptable       | Load testing                  | Within 20% of original         |
| No domain layer changes      | Git diff                      | Zero changes in `core/domain/` |

**Common Pitfalls When Switching:**

| Pitfall                               | Prevention                                     |
| ------------------------------------- | ---------------------------------------------- |
| ORM-specific types leaked into domain | Enforce zero ORM imports in domain via linting |
| Query syntax assumptions              | Use specification pattern, not raw strings     |
| Auto-increment vs UUID                | Use UUID from start, abstract ID generation    |
| Timestamp handling                    | Use domain value objects for dates             |
| Null vs undefined semantics           | Explicit null handling in mappers              |
| Cascade behavior differences          | Define cascade explicitly in domain events     |

---

## 9. Folder Structure

```
src/
├── core/                           # Framework-agnostic business logic
│   ├── domain/                     # Domain layer (ZERO external dependencies)
│   │   ├── entities/               # Domain entities (pure TS, NO ORM decorators)
│   │   ├── value-objects/          # Value objects (immutable)
│   │   ├── events/                 # Domain events
│   │   ├── services/               # Domain services
│   │   ├── factories/              # Entity factories
│   │   ├── ports/                  # Interfaces (abstractions) - DB-agnostic contracts
│   │   │   ├── repositories/       # Repository interfaces (IUserRepository, etc.)
│   │   │   ├── unit-of-work.ts     # IUnitOfWork interface
│   │   │   └── services/           # External service interfaces
│   │   └── exceptions/             # Domain exceptions
│   │
│   └── application/                # Application layer
│       ├── commands/               # Command definitions
│       ├── queries/                # Query definitions
│       ├── handlers/               # Command/Query handlers
│       ├── use-cases/              # Use case implementations
│       ├── services/               # Application services
│       ├── dtos/                   # Internal DTOs
│       └── events/                 # Application event handlers
│
├── infrastructure/                 # Technical implementations
│   ├── persistence/                # Database access
│   │   ├── typeorm/                # TypeORM implementation (PostgreSQL/MySQL)
│   │   │   ├── entities/           # ORM entities (with decorators)
│   │   │   ├── migrations/         # Database migrations
│   │   │   ├── repositories/       # Repository implementations
│   │   │   └── unit-of-work.ts     # Transaction management
│   │   ├── prisma/                 # Prisma implementation (alternative)
│   │   │   ├── schema.prisma       # Prisma schema
│   │   │   ├── repositories/       # Repository implementations
│   │   │   └── unit-of-work.ts     # Transaction management
│   │   ├── mongoose/               # MongoDB implementation (alternative)
│   │   │   ├── schemas/            # Mongoose schemas
│   │   │   ├── repositories/       # Repository implementations
│   │   │   └── unit-of-work.ts     # Transaction management
│   │   └── mappers/                # Entity ↔ Domain mappers (shared or per-ORM)
│   ├── cache/                      # Cache implementations
│   ├── messaging/                  # In-process domain event bus
│   ├── jobs/                       # Bull producers, consumers, schedulers
│   ├── external/                   # External API adapters
│   └── config/                     # Infrastructure configuration
│
├── presentation/                   # Framework-specific entry points
│   ├── rest/                       # REST API
│   │   ├── controllers/            # HTTP controllers
│   │   ├── dtos/                   # Request/Response DTOs
│   │   ├── decorators/             # Custom decorators
│   │   └── filters/                # Exception filters
│   ├── graphql/                    # GraphQL API
│   │   ├── resolvers/              # GraphQL resolvers
│   │   └── types/                  # GraphQL type definitions
│   └── websocket/                  # WebSocket
│       └── gateways/               # WebSocket gateways
│
├── modules/                        # NestJS module definitions
│   ├── auth/                       # Auth module
│   ├── user/                       # User module
│   ├── role/                       # Role module
│   └── [feature]/                  # Other feature modules
│
├── shared/                         # Shared utilities
│   ├── constants/                  # Application constants
│   ├── decorators/                 # Shared decorators
│   ├── guards/                     # Shared guards
│   ├── interceptors/               # Shared interceptors
│   ├── pipes/                      # Shared pipes
│   ├── filters/                    # Shared filters
│   └── utils/                      # Utility functions
│
├── config/                         # Configuration
│   ├── app.config.ts               # App configuration
│   ├── database.config.ts          # Database configuration
│   └── [feature].config.ts         # Feature configurations
│
├── app.module.ts                   # API root module
├── worker.module.ts                # Worker root module
├── scheduler.module.ts             # Scheduler root module
├── main.ts                         # HTTP/GraphQL/WebSocket entry point
├── main.worker.ts                  # Bull consumer entry point
└── main.scheduler.ts               # Cron producer entry point
```

---

## 10. Naming Conventions

### 10.1 Files & Directories

| Type      | Convention           | Example                        |
| --------- | -------------------- | ------------------------------ |
| Directory | `kebab-case`         | `user-management/`             |
| File      | `kebab-case.type.ts` | `create-user.use-case.ts`      |
| Test file | `*.spec.ts`          | `create-user.use-case.spec.ts` |
| E2E test  | `*.e2e-spec.ts`      | `user.e2e-spec.ts`             |

### 10.2 Classes

| Type                 | Convention        | Example               |
| -------------------- | ----------------- | --------------------- |
| Entity               | `PascalCase`      | `User`, `Order`       |
| ValueObject          | `PascalCase`      | `Email`, `Money`      |
| UseCase              | `VerbNounUseCase` | `CreateUserUseCase`   |
| Command              | `VerbNounCommand` | `CreateUserCommand`   |
| Query                | `VerbNounQuery`   | `GetUserByIdQuery`    |
| Handler              | `NounHandler`     | `CreateUserHandler`   |
| Repository Interface | `INounRepository` | `IUserRepository`     |
| Repository Impl      | `NounRepository`  | `UserRepository`      |
| Controller           | `NounController`  | `UserController`      |
| Service              | `NounService`     | `UserService`         |
| Guard                | `NounGuard`       | `JwtAuthGuard`        |
| Pipe                 | `NounPipe`        | `ValidationPipe`      |
| Filter               | `NounFilter`      | `HttpExceptionFilter` |
| Interceptor          | `NounInterceptor` | `LoggingInterceptor`  |
| DTO                  | `VerbNounDto`     | `CreateUserDto`       |
| Event                | `NounVerbedEvent` | `UserCreatedEvent`    |

### 10.3 Variables & Methods

| Type             | Convention              | Example                      |
| ---------------- | ----------------------- | ---------------------------- |
| Variable         | `camelCase`             | `userName`, `isActive`       |
| Constant         | `UPPER_SNAKE_CASE`      | `MAX_RETRY_COUNT`            |
| Private property | `camelCase` (no prefix) | `userRepository`             |
| Method           | `camelCase`             | `findById()`, `createUser()` |
| Boolean          | `is/has/can` prefix     | `isActive`, `hasPermission`  |

### 10.4 Database

| Type        | Convention            | Example                 |
| ----------- | --------------------- | ----------------------- |
| Table       | `snake_case` (plural) | `users`, `order_items`  |
| Column      | `snake_case`          | `created_at`, `user_id` |
| Index       | `idx_table_columns`   | `idx_users_email`       |
| Foreign Key | `fk_table_ref`        | `fk_orders_user`        |
| Unique      | `uq_table_columns`    | `uq_users_email`        |

---

## 11. API Response Standards

### 11.1 Response Envelope

**All API responses MUST follow this envelope structure:**

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}
```

---

### 11.2 Success Response

**Single Resource:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Collection (with Pagination):**

```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "Item 1" },
    { "id": "...", "name": "Item 2" }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

**Empty Collection:**

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 0,
      "totalPages": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

**Action Response (No Content):**

```json
{
  "success": true,
  "data": {
    "message": "Email sent successfully"
  }
}
```

**Delete Response:**

> **Note:** Use 200 with body (not 204) to maintain consistent envelope structure.

```json
// Soft delete - returns updated resource
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deletedAt": "2026-01-15T10:30:00.000Z"
  }
}

// Hard delete - returns confirmation
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### 11.3 Error Response

**Standard Error Structure:**

```typescript
interface ApiError {
  code: string; // Machine-readable error code
  message: string; // Human-readable message (fallback)
  messageKey?: string; // i18n key for client-side translation
  details?: ErrorDetail[]; // Field-level errors (validation)
  timestamp: string; // ISO 8601 timestamp
  path: string; // Request path
  requestId: string; // Correlation ID for tracing
}

interface ErrorDetail {
  field: string; // Field name (dot notation for nested)
  message: string; // Validation message (fallback)
  messageKey: string; // i18n key (e.g., "validation.email.invalid")
  code: string; // Validation rule code
  value?: unknown; // Rejected value (optional, sanitized)
  constraints?: Record<string, unknown>; // Constraint values for interpolation
}
```

---

### 11.4 Error Response Examples

**Validation Error (400):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "must be a valid email address",
        "code": "isEmail"
      },
      {
        "field": "password",
        "message": "must be at least 8 characters",
        "code": "minLength",
        "value": "***"
      },
      {
        "field": "profile.age",
        "message": "must be a positive number",
        "code": "isPositive"
      }
    ],
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users",
    "requestId": "req_abc123xyz"
  }
}
```

**Authentication Error (401):**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users/me",
    "requestId": "req_abc123xyz"
  }
}
```

**Authorization Error (403):**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/admin/users",
    "requestId": "req_abc123xyz"
  }
}
```

**Not Found Error (404):**

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User not found",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users/550e8400-e29b-41d4-a716-446655440000",
    "requestId": "req_abc123xyz"
  }
}
```

**Business Logic Error (422):**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Account balance is insufficient for this transaction",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/transactions",
    "requestId": "req_abc123xyz"
  }
}
```

**Rate Limit Error (429):**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users",
    "requestId": "req_abc123xyz"
  }
}
```

**Internal Server Error (500):**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "path": "/api/v1/users",
    "requestId": "req_abc123xyz"
  }
}
```

---

### 11.5 HTTP Status Code Mapping

| Status  | Code                   | Usage                                           |
| ------- | ---------------------- | ----------------------------------------------- |
| **200** | OK                     | Successful GET, PUT, PATCH, DELETE (with body)  |
| **201** | Created                | Successful POST (resource created)              |
| **400** | Bad Request            | Validation errors, malformed request            |
| **401** | Unauthorized           | Missing or invalid authentication               |
| **403** | Forbidden              | Authenticated but not authorized                |
| **404** | Not Found              | Resource does not exist                         |
| **409** | Conflict               | Resource conflict (duplicate, version mismatch) |
| **412** | Precondition Failed    | ETag mismatch, conditional request failed       |
| **413** | Payload Too Large      | Request body exceeds limit                      |
| **415** | Unsupported Media Type | Invalid Content-Type header                     |
| **422** | Unprocessable Entity   | Business logic errors                           |
| **424** | Failed Dependency      | Cascading failure from dependent service        |
| **429** | Too Many Requests      | Rate limit exceeded                             |
| **500** | Internal Server Error  | Unexpected server errors                        |
| **502** | Bad Gateway            | Upstream service failure                        |
| **503** | Service Unavailable    | Service temporarily unavailable                 |
| **504** | Gateway Timeout        | Upstream service timeout                        |

> **Note:** We use 200 instead of 204 for DELETE to maintain consistent response envelope.

---

### 11.6 Error Code Registry

| Code                       | HTTP Status | Description                          |
| -------------------------- | ----------- | ------------------------------------ |
| `VALIDATION_ERROR`         | 400         | Request validation failed            |
| `INVALID_JSON`             | 400         | Malformed JSON body                  |
| `INVALID_QUERY_PARAMS`     | 400         | Invalid query parameters             |
| `UNAUTHORIZED`             | 401         | Authentication required              |
| `INVALID_TOKEN`            | 401         | Token is invalid or malformed        |
| `TOKEN_EXPIRED`            | 401         | Token has expired                    |
| `TOKEN_REVOKED`            | 401         | Token has been revoked (blacklisted) |
| `FORBIDDEN`                | 403         | Access denied                        |
| `INSUFFICIENT_PERMISSIONS` | 403         | Missing required permissions         |
| `RESOURCE_NOT_FOUND`       | 404         | Requested resource not found         |
| `ROUTE_NOT_FOUND`          | 404         | API endpoint does not exist          |
| `METHOD_NOT_ALLOWED`       | 405         | HTTP method not supported            |
| `CONFLICT`                 | 409         | Resource already exists              |
| `DUPLICATE_RESOURCE`       | 409         | Duplicate entry for unique field     |
| `VERSION_CONFLICT`         | 409         | Optimistic lock version mismatch     |
| `PRECONDITION_FAILED`      | 412         | ETag or If-Match condition failed    |
| `PAYLOAD_TOO_LARGE`        | 413         | Request body exceeds size limit      |
| `UNSUPPORTED_MEDIA_TYPE`   | 415         | Invalid Content-Type                 |
| `BUSINESS_RULE_VIOLATION`  | 422         | Domain business rule violated        |
| `INSUFFICIENT_BALANCE`     | 422         | Not enough balance                   |
| `INVALID_STATE_TRANSITION` | 422         | Invalid status change                |
| `DEPENDENCY_FAILED`        | 424         | Required dependent operation failed  |
| `RATE_LIMIT_EXCEEDED`      | 429         | Too many requests                    |
| `INTERNAL_ERROR`           | 500         | Unexpected server error              |
| `DATABASE_ERROR`           | 500         | Database operation failed            |
| `EXTERNAL_SERVICE_ERROR`   | 502         | Third-party service failure          |
| `SERVICE_UNAVAILABLE`      | 503         | Service temporarily down             |
| `GATEWAY_TIMEOUT`          | 504         | Upstream service timeout             |

---

### 11.7 Response Headers

**Standard Headers:**

| Header            | Value                             | Purpose                |
| ----------------- | --------------------------------- | ---------------------- |
| `Content-Type`    | `application/json; charset=utf-8` | Response format        |
| `X-Request-Id`    | `req_abc123xyz`                   | Request correlation ID |
| `X-Response-Time` | `125ms`                           | Processing time        |

**Pagination Headers (Alternative):**

| Header          | Value               | Purpose                   |
| --------------- | ------------------- | ------------------------- |
| `X-Total-Count` | `150`               | Total items               |
| `X-Total-Pages` | `8`                 | Total pages               |
| `X-Page`        | `1`                 | Current page              |
| `X-Limit`       | `20`                | Items per page            |
| `Link`          | `<...>; rel="next"` | RFC 5988 pagination links |

**Rate Limit Headers:**

| Header                  | Value        | Purpose                          |
| ----------------------- | ------------ | -------------------------------- |
| `X-RateLimit-Limit`     | `100`        | Max requests per window          |
| `X-RateLimit-Remaining` | `95`         | Remaining requests               |
| `X-RateLimit-Reset`     | `1705312200` | Unix timestamp when limit resets |
| `Retry-After`           | `60`         | Seconds to wait (when 429)       |

**Cache Headers:**

| Header          | Value                           | Purpose          |
| --------------- | ------------------------------- | ---------------- |
| `Cache-Control` | `private, max-age=300`          | Cache directive  |
| `ETag`          | `"abc123"`                      | Resource version |
| `Last-Modified` | `Mon, 15 Jan 2026 10:30:00 GMT` | Last update time |

---

### 11.8 Pagination Standards

**Query Parameters:**

| Parameter       | Type   | Default      | Max | Description                      |
| --------------- | ------ | ------------ | --- | -------------------------------- |
| `page`          | number | 1            | -   | Page number (1-indexed)          |
| `limit`         | number | 20           | 100 | Items per page                   |
| `sort`          | string | `-createdAt` | -   | Sort field (`-` prefix for DESC) |
| `filter[field]` | string | -            | -   | Filter by field value            |

**Example Request:**

```
GET /api/v1/users?page=2&limit=20&sort=-createdAt&filter[status]=active
```

**Pagination Strategy Selection:**

| Type              | Use When                                         | Performance                 | Consistency                              |
| ----------------- | ------------------------------------------------ | --------------------------- | ---------------------------------------- |
| **Offset-based**  | Small datasets (< 10K), admin panels             | O(n) - degrades with offset | May skip/duplicate on concurrent changes |
| **Cursor/Keyset** | Large datasets, infinite scroll, real-time feeds | O(1) - uses index seek      | Consistent view from cursor position     |

> **Note:** Cursor-based and keyset-based pagination are often used interchangeably. Both use indexed columns (like `id` or `created_at`) for efficient seeks instead of OFFSET.

> **Rule:** Use offset for page ≤ 100, cursor/keyset for larger datasets.

**Cursor-Based Pagination (for large datasets):**

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "cursor": "eyJpZCI6MTAwfQ==",
      "nextCursor": "eyJpZCI6MTIwfQ==",
      "prevCursor": "eyJpZCI6ODB9",
      "limit": 20,
      "hasMore": true
    }
  }
}
```

**Cursor Implementation:**

```typescript
interface CursorPaginationParams {
  cursor?: string; // Opaque cursor (base64 encoded)
  limit: number; // Max 100
  direction: 'forward' | 'backward'; // Scroll direction
}

// Cursor encodes: { id, sortValue, timestamp }
// Decode: Buffer.from(cursor, 'base64').toString('utf8')
```

**Keyset Pagination (Time-Series):**

```typescript
// Request: GET /api/v1/events?after=2026-01-15T10:30:00Z&limit=20
// Or: GET /api/v1/events?afterId=uuid&limit=20

// Query (efficient with index on created_at, id):
SELECT * FROM events
WHERE (created_at, id) > ($after_time, $after_id)
ORDER BY created_at ASC, id ASC
LIMIT 21;  -- Fetch limit+1 to check hasMore
```

**Pagination Response Headers (Alternative to body meta):**

```http
Link: <https://api.example.com/users?cursor=abc>; rel="next",
      <https://api.example.com/users?cursor=xyz>; rel="prev"
X-Total-Count: 1500
X-Has-More: true
```

---

### 11.9 Response Rules

| Rule                        | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| **Consistent envelope**     | All responses use the same structure                             |
| **No null data**            | Use empty array `[]` or omit field, never `null` for collections |
| **ISO 8601 dates**          | All timestamps in UTC with `Z` suffix                            |
| **UUID for IDs**            | Use UUID v4 for all resource identifiers                         |
| **Error code format**       | Use SCREAMING_SNAKE_CASE for error codes                         |
| **No sensitive data**       | Never expose passwords, tokens, internal IDs in errors           |
| **Consistent field naming** | Use camelCase for JSON fields                                    |
| **Include requestId**       | Every error must include requestId for debugging                 |

### 11.10 DTO Validation Examples

**User Registration DTO:**

```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  ValidateNested,
  IsArray,
  ArrayMaxSize,
  IsNotEmpty,
  Length,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail({}, { message: 'validation.email.invalid' })
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'validation.password.minLength' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'validation.password.weak',
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'validation.phone.invalid' })
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

// Nested DTO
export class AddressDto {
  @IsString()
  @MaxLength(200)
  street: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsString()
  @MaxLength(20)
  postalCode: string;

  @IsString()
  @Length(2, 2)
  countryCode: string;
}
```

**Query Parameters DTO:**

```typescript
import { IsOptional, IsString, IsIn, IsInt, Min, Max, Matches, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @Matches(/^-?[a-zA-Z_]+$/) // e.g., "-createdAt" or "name"
  sort?: string = '-createdAt';

  @IsOptional()
  @IsIn(['active', 'inactive', 'pending']) // Use @IsIn for string arrays
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  search?: string;
}
```

**File Upload Validation:**

```typescript
import { FileValidator } from '@nestjs/common';

// Magic bytes signatures for common file types
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
};

export class FileValidationPipe extends FileValidator {
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

  private readonly maxSize = 5 * 1024 * 1024; // 5MB

  isValid(file: Express.Multer.File): boolean {
    if (!file) return false;
    if (file.size > this.maxSize) return false;
    if (!this.allowedMimeTypes.includes(file.mimetype)) return false;

    // Validate magic bytes (not just extension) - prevents file type spoofing
    return this.validateMagicBytes(file.buffer, file.mimetype);
  }

  private validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const expectedBytes = MAGIC_BYTES[mimeType];
    if (!expectedBytes) return false;

    // Check if file starts with expected magic bytes
    for (let i = 0; i < expectedBytes.length; i++) {
      if (buffer[i] !== expectedBytes[i]) return false;
    }
    return true;
  }

  buildErrorMessage(): string {
    return 'Invalid file: must be JPEG, PNG, GIF, or PDF under 5MB';
  }
}
```

---

## 12. Production Readiness

### 12.1 Resilience Patterns

| Pattern             | Purpose                         | Implementation                        | When to Use                              |
| ------------------- | ------------------------------- | ------------------------------------- | ---------------------------------------- |
| **Circuit Breaker** | Fail fast on cascading failures | `@nestjs/terminus` + custom decorator | External API calls, database connections |
| **Retry**           | Handle transient failures       | Exponential backoff with jitter       | Network operations, queue publishing     |
| **Timeout**         | Prevent hanging requests        | Per-operation timeout config          | All external calls (default: 5s)         |
| **Bulkhead**        | Isolate failures                | Separate connection pools             | Critical vs non-critical paths           |
| **Fallback**        | Graceful degradation            | Cache fallback, default responses     | Non-critical features                    |

**Circuit Breaker States:**

| State         | Behavior                                | Transition                           |
| ------------- | --------------------------------------- | ------------------------------------ |
| **Closed**    | Normal operation, requests pass through | → Open (after N failures)            |
| **Open**      | Requests fail immediately               | → Half-Open (after timeout)          |
| **Half-Open** | Limited requests to test recovery       | → Closed (success) or Open (failure) |

**Retry Configuration:**

| Operation Type  | Max Retries | Initial Delay | Max Delay | Backoff              |
| --------------- | ----------- | ------------- | --------- | -------------------- |
| Database query  | 3           | 100ms         | 2s        | Exponential          |
| External API    | 3           | 500ms         | 10s       | Exponential + jitter |
| Queue publish   | 5           | 200ms         | 5s        | Exponential          |
| Cache operation | 2           | 50ms          | 500ms     | Linear               |

**Retry Only on Retryable Errors:**

```typescript
// Only retry on transient errors
const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND'];

const retryableHttpStatuses = [408, 429, 500, 502, 503, 504];

function isRetryable(error: any): boolean {
  if (error.code && retryableErrors.includes(error.code)) return true;
  if (error.status && retryableHttpStatuses.includes(error.status)) return true;
  if (error instanceof TimeoutError) return true;
  return false;
}
```

**Bulkhead Pattern Implementation:**

| Resource      | Critical Path Pool | Normal Path Pool | Purpose                  |
| ------------- | ------------------ | ---------------- | ------------------------ |
| Database      | 20 connections     | 30 connections   | Isolate critical queries |
| HTTP client   | 50 concurrent      | 100 concurrent   | Isolate external calls   |
| Queue workers | 5 workers          | 20 workers       | Isolate job processing   |

```typescript
// Separate connection pools for critical vs normal operations
@Module({
  providers: [
    {
      provide: 'CRITICAL_DB_POOL',
      useFactory: () =>
        createPool({
          max: 20,
          min: 5,
          idleTimeoutMillis: 30000,
        }),
    },
    {
      provide: 'NORMAL_DB_POOL',
      useFactory: () =>
        createPool({
          max: 30,
          min: 5,
          idleTimeoutMillis: 60000,
        }),
    },
  ],
})
// Usage in service
@Injectable()
class PaymentService {
  constructor(
    @Inject('CRITICAL_DB_POOL') private criticalPool: Pool,
    @Inject('NORMAL_DB_POOL') private normalPool: Pool,
  ) {}

  // Critical payment processing uses dedicated pool
  async processPayment(data: PaymentDto) {
    const client = await this.criticalPool.connect();
    try {
      // Payment logic
    } finally {
      client.release();
    }
  }

  // Non-critical reporting uses normal pool
  async getPaymentHistory(userId: string) {
    const client = await this.normalPool.connect();
    // ...
  }
}
```

**Semaphore for Concurrent Request Limiting:**

```typescript
// Limit concurrent external API calls
import { Semaphore, withTimeout } from 'async-mutex';
import { firstValueFrom } from 'rxjs';

@Injectable()
class ExternalApiService {
  // Max 10 concurrent requests with 30s timeout for acquiring slot
  private semaphore = withTimeout(new Semaphore(10), 30000);

  async callExternalApi(data: any) {
    const [value, release] = await this.semaphore.acquire();
    try {
      // Use firstValueFrom instead of deprecated toPromise()
      return await firstValueFrom(this.httpService.post(url, data));
    } finally {
      release();
    }
  }
}
```

---

### 12.2 Graceful Shutdown

| Phase                    | Timeout   | Actions                                  |
| ------------------------ | --------- | ---------------------------------------- |
| **1. Stop accepting**    | Immediate | Stop accepting new connections           |
| **2. Drain requests**    | 30s       | Complete in-flight requests              |
| **3. Close connections** | 10s       | Close database, Redis, queue connections |
| **4. Flush buffers**     | 5s        | Flush logs, metrics, pending events      |
| **5. Exit**              | Immediate | Process exit with code 0                 |

**Shutdown Hooks Priority:**

| Order | Hook                          | Purpose              |
| ----- | ----------------------------- | -------------------- |
| 1     | `onModuleDestroy()`           | Module-level cleanup |
| 2     | `beforeApplicationShutdown()` | Pre-shutdown tasks   |
| 3     | `onApplicationShutdown()`     | Final cleanup        |

**Signals to Handle:**

| Signal    | Source             | Action                   |
| --------- | ------------------ | ------------------------ |
| `SIGTERM` | Kubernetes, Docker | Graceful shutdown        |
| `SIGINT`  | Ctrl+C, CLI        | Graceful shutdown        |
| `SIGQUIT` | Core dump request  | Graceful shutdown + dump |

---

### 12.3 Health Checks

| Endpoint          | Purpose                   | Frequency | Timeout |
| ----------------- | ------------------------- | --------- | ------- |
| `/health/live`    | Is process alive?         | 10s       | 1s      |
| `/health/ready`   | Ready to serve traffic?   | 5s        | 3s      |
| `/health/startup` | Initial startup complete? | 5s        | 30s     |

**Liveness Check (Kubernetes livenessProbe):**

| Check                  | Pass Condition | Failure Action    |
| ---------------------- | -------------- | ----------------- |
| Process responsive     | HTTP 200       | Restart container |
| Event loop not blocked | Response < 1s  | Restart container |

**Readiness Check (Kubernetes readinessProbe):**

| Check                | Pass Condition          | Failure Action            |
| -------------------- | ----------------------- | ------------------------- |
| Database connected   | Connection pool healthy | Remove from load balancer |
| Redis connected      | Ping successful         | Remove from load balancer |
| Migrations complete  | Schema version matches  | Remove from load balancer |
| Dependencies healthy | External APIs reachable | Remove from load balancer |

**Startup Check (Kubernetes startupProbe):**

| Check               | Pass Condition            | Max Duration |
| ------------------- | ------------------------- | ------------ |
| Database migrations | All migrations applied    | 60s          |
| Cache warmup        | Critical data loaded      | 30s          |
| Config validation   | All required env vars set | 5s           |

**Deep Health Check (Internal Monitoring):**

```typescript
// GET /health/deep - Detailed dependency health (internal use only)
@Get('/health/deep')
@UseGuards(InternalOnlyGuard)  // Only allow internal/admin access
async deepHealth(): Promise<DeepHealthResponse> {
  const checks = await Promise.allSettled([
    this.checkDatabase(),
    this.checkRedis(),
    this.checkExternalApis(),
    this.checkDiskSpace(),
    this.checkMemory(),
    this.checkCertificates()
  ]);

  return {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: this.extractResult(checks[0]),
      redis: this.extractResult(checks[1]),
      externalApis: this.extractResult(checks[2]),
      disk: this.extractResult(checks[3]),
      memory: this.extractResult(checks[4]),
      certificates: this.extractResult(checks[5])
    }
  };
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;     // Response time in ms
  message?: string;     // Error or warning message
  metadata?: Record<string, unknown>;
}
```

**Resource Thresholds:**

| Resource           | Warning   | Critical | Action             |
| ------------------ | --------- | -------- | ------------------ |
| Memory usage       | > 70%     | > 85%    | Scale up / Alert   |
| Disk usage         | > 70%     | > 90%    | Cleanup / Alert    |
| CPU usage          | > 70%     | > 90%    | Scale up / Alert   |
| DB connections     | > 70%     | > 90%    | Scale pool / Alert |
| Certificate expiry | < 30 days | < 7 days | Renew / Alert      |

---

### 12.4 Caching Strategy

**Cache Layers:**

| Layer                | Technology            | TTL        | Use Case                    |
| -------------------- | --------------------- | ---------- | --------------------------- |
| **L1 (In-Memory)**   | Node.js Map/LRU       | 1-5 min    | Hot data, session           |
| **L2 (Distributed)** | Redis                 | 5-60 min   | Shared state, API responses |
| **L3 (CDN)**         | CloudFront/Cloudflare | 1-24 hours | Static assets, public API   |

**Cache Patterns:**

| Pattern           | Description                    | When to Use            |
| ----------------- | ------------------------------ | ---------------------- |
| **Cache-Aside**   | App manages cache manually     | Default for most cases |
| **Write-Through** | Write to cache and DB together | High consistency needs |
| **Write-Behind**  | Write to cache, async to DB    | High write throughput  |
| **Read-Through**  | Cache fetches from DB on miss  | Simple read patterns   |

**Cache Invalidation Strategy:**

| Strategy          | Trigger             | Consistency           |
| ----------------- | ------------------- | --------------------- |
| **TTL-based**     | Time expiration     | Eventual (TTL window) |
| **Event-based**   | Domain events       | Near real-time        |
| **Version-based** | Entity version bump | Strong                |
| **Manual**        | Admin action        | On-demand             |

**TTL Guidelines:**

| Data Type       | TTL        | Invalidation              |
| --------------- | ---------- | ------------------------- |
| User session    | 24 hours   | On logout/password change |
| User profile    | 15 minutes | On profile update event   |
| Configuration   | 5 minutes  | On config change event    |
| Public listings | 1 hour     | TTL only                  |
| Search results  | 5 minutes  | TTL only                  |

---

### 12.5 Security Hardening

**HTTP Security Headers:**

| Header                         | Value                                          | Purpose                 |
| ------------------------------ | ---------------------------------------------- | ----------------------- |
| `Strict-Transport-Security`    | `max-age=31536000; includeSubDomains; preload` | Force HTTPS             |
| `X-Content-Type-Options`       | `nosniff`                                      | Prevent MIME sniffing   |
| `X-Frame-Options`              | `DENY`                                         | Prevent clickjacking    |
| `Content-Security-Policy`      | `default-src 'self'; frame-ancestors 'none'`   | Resource loading policy |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`              | Referrer control        |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=()`     | Feature restrictions    |
| `X-DNS-Prefetch-Control`       | `off`                                          | Prevent DNS prefetch    |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                  | Process isolation       |
| `Cross-Origin-Resource-Policy` | `same-origin`                                  | Resource isolation      |
| `Cross-Origin-Embedder-Policy` | `require-corp`                                 | Embedding control       |

> **Note:** `X-XSS-Protection` is deprecated. Modern browsers use CSP instead.

**Helmet.js Configuration:**

```typescript
// main.ts
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Adjust per needs
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.example.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true, // Legacy support
  }),
);
```

**Secrets Management:**

| Secret Type          | Storage                     | Rotation            |
| -------------------- | --------------------------- | ------------------- |
| Database credentials | Vault / AWS Secrets Manager | 90 days             |
| JWT signing key      | Vault / AWS Secrets Manager | 30 days             |
| API keys (external)  | Vault / AWS Secrets Manager | Per provider policy |
| Encryption keys      | AWS KMS / HashiCorp Vault   | Yearly              |

**Rate Limiting Tiers:**

| Tier              | Requests/min | Burst | Scope         |
| ----------------- | ------------ | ----- | ------------- |
| **Anonymous**     | 30           | 10    | IP address    |
| **Authenticated** | 100          | 30    | User ID       |
| **Premium**       | 500          | 100   | User ID       |
| **Internal**      | 1000         | 500   | Service token |

**Rate Limiting Implementation:**

| Strategy           | Use Case        | Pros                     | Cons                  |
| ------------------ | --------------- | ------------------------ | --------------------- |
| **Fixed Window**   | Simple APIs     | Easy to implement        | Burst at window edges |
| **Sliding Window** | Production APIs | Smoother distribution    | More memory           |
| **Token Bucket**   | Variable rate   | Allows controlled bursts | Complex               |

```typescript
// Distributed rate limiting with Redis (required for multi-instance)
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 3 },   // 3 req/sec
        { name: 'medium', ttl: 10000, limit: 20 }, // 20 req/10sec
        { name: 'long', ttl: 60000, limit: 100 }   // 100 req/min
      ],
      storage: new ThrottlerStorageRedisService(redisClient)
    })
  ]
})
```

**JWT Security Best Practices:**

| Practice                      | Implementation                   | Purpose                |
| ----------------------------- | -------------------------------- | ---------------------- |
| **Short-lived access tokens** | 15-30 minutes TTL                | Limit exposure window  |
| **Refresh token rotation**    | Single-use, issue new on refresh | Detect token theft     |
| **Token blacklisting**        | Redis set with TTL               | Immediate revocation   |
| **JTI (JWT ID)**              | Unique ID per token              | Prevent replay attacks |
| **Audience validation**       | `aud` claim check                | Prevent token misuse   |
| **Issuer validation**         | `iss` claim check                | Verify token source    |

**JWT Algorithm Selection:**

| Algorithm | Type               | Use Case                            | Key Management          |
| --------- | ------------------ | ----------------------------------- | ----------------------- |
| **HS256** | Symmetric          | Single service only                 | Shared secret           |
| **RS256** | Asymmetric (RSA)   | Distributed services, microservices | Public/private key pair |
| **ES256** | Asymmetric (ECDSA) | Mobile/IoT, bandwidth-sensitive     | Smaller signatures      |

> **Recommendation:** Use **RS256** or **ES256** for production. Avoid HS256 in multi-service environments as the secret must be shared.

```typescript
// NestJS JWT Module config with RS256
JwtModule.registerAsync({
  useFactory: (config: ConfigService) => ({
    privateKey: config.get('JWT_PRIVATE_KEY'),
    publicKey: config.get('JWT_PUBLIC_KEY'),
    signOptions: {
      algorithm: 'RS256',
      expiresIn: '15m',
      issuer: 'auth.example.com',
      audience: 'api.example.com',
    },
    verifyOptions: {
      algorithms: ['RS256'], // IMPORTANT: Restrict accepted algorithms
      issuer: 'auth.example.com',
      audience: 'api.example.com',
    },
  }),
  inject: [ConfigService],
});
```

**Access Token Structure:**

```typescript
interface JwtPayload {
  sub: string; // User ID
  jti: string; // Unique token ID (for blacklist)
  iat: number; // Issued at
  exp: number; // Expiration (15-30 min)
  aud: string; // Audience (api.example.com)
  iss: string; // Issuer (auth.example.com)

  // Custom claims
  tenantId?: string;
  roles: string[];
  permissions: string[];
}
```

**Refresh Token Strategy:**

```typescript
interface RefreshToken {
  id: string; // Unique ID (stored in DB)
  userId: string;
  familyId: string; // Token family for rotation detection
  expiresAt: Date; // 7-30 days
  issuedAt: Date;
  revokedAt?: Date;
  replacedByTokenId?: string; // For rotation tracking

  // Security metadata
  userAgent: string;
  ipAddress: string;
}

// Rotation detection: if old token used after rotation, revoke entire family
```

**Token Blacklist Implementation:**

```typescript
@Injectable()
class TokenBlacklistService {
  constructor(private redis: RedisService) {}

  async blacklist(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${jti}`, '1', 'EX', ttl);
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return (await this.redis.exists(`blacklist:${jti}`)) === 1;
  }
}
```

**Token Binding (Optional - High Security):**

| Binding Type | When to Use          | Trade-off           |
| ------------ | -------------------- | ------------------- |
| IP binding   | Internal APIs, admin | Breaks on IP change |
| Fingerprint  | Web apps             | Requires client JS  |
| mTLS         | Service-to-service   | Complex setup       |

**Input Validation Layers:**

| Layer           | Validation Type   | Example                    |
| --------------- | ----------------- | -------------------------- |
| **API Gateway** | Schema validation | Request size, content-type |
| **Controller**  | DTO validation    | class-validator decorators |
| **Domain**      | Business rules    | Entity invariants          |
| **Database**    | Constraints       | NOT NULL, UNIQUE, CHECK    |

**Global ValidationPipe Configuration:**

```typescript
// main.ts - REQUIRED for production security
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip properties not in DTO (security!)
    forbidNonWhitelisted: true, // Reject unknown properties with 400
    transform: true, // Auto-transform to DTO class instances
    transformOptions: {
      enableImplicitConversion: false, // Explicit typing only (security!)
    },
    validationError: {
      target: false, // Don't expose class in error
      value: false, // Don't expose value in error (security!)
    },
    stopAtFirstError: false, // Return all errors, not just first
    errorHttpStatusCode: 400,
  }),
);
```

**Request Size Limits:**

| Content Type          | Max Size | Purpose               |
| --------------------- | -------- | --------------------- |
| `application/json`    | 1MB      | Standard API requests |
| `multipart/form-data` | 50MB     | File uploads          |
| `text/plain`          | 100KB    | Webhooks, logs        |

```typescript
// main.ts
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
```

**Nested Object Depth Limit (DoS Prevention):**

```typescript
// Prevent deeply nested objects that cause parsing DoS
app.use(
  json({
    limit: '1mb',
    verify: (req, res, buf) => {
      const depth = getJsonDepth(buf.toString());
      if (depth > 10) {
        throw new PayloadTooLargeException('JSON nesting too deep');
      }
    },
  }),
);
```

**CORS Configuration:**

```typescript
// main.ts - Production CORS
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://app.example.com', 'https://admin.example.com'];
    // Allow requests with no origin (mobile apps, Postman)
    // SECURITY: This also allows server-side requests. Ensure your
    // authentication layer validates ALL requests regardless of origin.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-Tenant-Id',
    'Accept-Language',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // Preflight cache 24h
});
```

---

### 12.6 Database Operations

**Connection Pool Configuration:**

| Environment | Min Connections | Max Connections | Idle Timeout |
| ----------- | --------------- | --------------- | ------------ |
| Development | 2               | 10              | 30s          |
| Staging     | 5               | 20              | 60s          |
| Production  | 10              | 50\*            | 120s         |

> **\*Production Pool Sizing Formula:**
>
> ```
> connections_per_instance = (cpu_cores * 2) + effective_spindle_count
> ```
>
> - For 4-core server: `(4 * 2) + 1 = 9` connections per instance
> - Total pool = `connections_per_instance * num_instances`
> - Never exceed `max_connections` on PostgreSQL (default: 100)

**Advanced Pool Settings:**

| Setting                     | Value  | Purpose                           |
| --------------------------- | ------ | --------------------------------- |
| `connectionTimeoutMillis`   | 10000  | Max wait for connection from pool |
| `idleTimeoutMillis`         | 120000 | Close idle connections after 2min |
| `max`                       | 50     | Max connections per instance      |
| `min`                       | 10     | Min connections to maintain       |
| `acquireTimeoutMillis`      | 30000  | Timeout acquiring connection      |
| `createTimeoutMillis`       | 30000  | Timeout creating new connection   |
| `destroyTimeoutMillis`      | 5000   | Timeout destroying connection     |
| `reapIntervalMillis`        | 1000   | Check for idle connections        |
| `createRetryIntervalMillis` | 200    | Retry delay on connection failure |

**Connection Validation:**

```typescript
// TypeORM config
{
  extra: {
    // Test connection before use (prevents stale connections)
    testOnBorrow: true,

    // Validate connection is alive
    validationQuery: 'SELECT 1',

    // Don't test on return (performance)
    testOnReturn: false
  }
}
```

**Query Timeout Settings:**

| Operation Type   | Timeout | Action on Timeout       |
| ---------------- | ------- | ----------------------- |
| Read query       | 5s      | Return error            |
| Write query      | 10s     | Return error            |
| Migration        | 300s    | Rollback                |
| Report/Analytics | 60s     | Return partial or error |

**PostgreSQL Timeout Configuration:**

| Setting                               | Value | Purpose                       |
| ------------------------------------- | ----- | ----------------------------- |
| `statement_timeout`                   | 30000 | Max query execution time (ms) |
| `lock_timeout`                        | 10000 | Max wait for lock (ms)        |
| `idle_in_transaction_session_timeout` | 60000 | Kill idle transaction (ms)    |

```typescript
// TypeORM config - per-connection defaults
{
  extra: {
    options: '-c statement_timeout=30000 -c lock_timeout=10000';
  }
}

// Per-query timeout override
await queryRunner.query('SET LOCAL statement_timeout = 5000');
await queryRunner.query('SELECT * FROM large_table WHERE ...');
```

**Transaction Isolation Levels:**

| Level             | Use Case                        | Trade-off                    |
| ----------------- | ------------------------------- | ---------------------------- |
| `READ COMMITTED`  | Default for most operations     | May see non-repeatable reads |
| `REPEATABLE READ` | Financial transactions, reports | Higher lock contention       |
| `SERIALIZABLE`    | Critical consistency (rare)     | Highest lock contention      |

**Read Replica Routing:**

| Operation                       | Target  | Consistency           |
| ------------------------------- | ------- | --------------------- |
| Write (INSERT, UPDATE, DELETE)  | Primary | Strong                |
| Read after write (same request) | Primary | Strong                |
| General reads                   | Replica | Eventual (~100ms lag) |
| Reports/Analytics               | Replica | Eventual              |

**Backup Strategy:**

| Backup Type   | Frequency  | Retention | Recovery Time  |
| ------------- | ---------- | --------- | -------------- |
| Full snapshot | Daily      | 30 days   | 1-2 hours      |
| WAL/Binlog    | Continuous | 7 days    | Minutes (PITR) |
| Logical dump  | Weekly     | 90 days   | 2-4 hours      |

---

### 12.7 Observability Details

**Log Levels by Environment:**

| Level     | Development | Staging | Production |
| --------- | ----------- | ------- | ---------- |
| `error`   | ✅          | ✅      | ✅         |
| `warn`    | ✅          | ✅      | ✅         |
| `info`    | ✅          | ✅      | ✅         |
| `debug`   | ✅          | ✅      | ❌         |
| `verbose` | ✅          | ❌      | ❌         |

**Structured Log Fields:**

| Field           | Type     | Purpose                |
| --------------- | -------- | ---------------------- |
| `timestamp`     | ISO 8601 | When event occurred    |
| `level`         | string   | Log severity           |
| `correlationId` | UUID     | Request tracing        |
| `userId`        | UUID     | User attribution       |
| `tenantId`      | UUID     | Tenant isolation       |
| `service`       | string   | Service name           |
| `method`        | string   | HTTP method            |
| `path`          | string   | Request path           |
| `statusCode`    | number   | Response status        |
| `duration`      | number   | Request duration (ms)  |
| `error`         | object   | Error details (if any) |

**Correlation ID Propagation:**

```typescript
// 1. Middleware extracts/generates correlation ID
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-request-id'] || uuidv4();
    req['correlationId'] = correlationId;

    // Store in AsyncLocalStorage for async context
    asyncLocalStorage.run({ correlationId, userId: null }, () => {
      res.setHeader('X-Request-Id', correlationId);
      next();
    });
  }
}

// 2. Logger automatically includes correlation ID
const context = asyncLocalStorage.getStore();
logger.info('Processing request', { correlationId: context?.correlationId });

// 3. Outgoing requests include correlation ID
httpService.get(url, {
  headers: { 'X-Request-Id': context?.correlationId },
});
```

**Sensitive Data Masking:**

| Data Type   | Masking Pattern       | Example                                     |
| ----------- | --------------------- | ------------------------------------------- |
| Email       | `u***@domain.com`     | `john.doe@example.com` → `j***@example.com` |
| Phone       | `***-***-XXXX`        | `555-123-4567` → `***-***-4567`             |
| Credit Card | `****-****-****-XXXX` | Full number → `****-****-****-1234`         |
| SSN/ID      | `***-**-XXXX`         | Full SSN → `***-**-6789`                    |
| Password    | `[REDACTED]`          | Any password → `[REDACTED]`                 |
| Token       | `[REDACTED]`          | Any token → `[REDACTED]`                    |
| API Key     | `****...XXXX`         | Full key → `****...abcd`                    |

```typescript
// Masking implementation
const maskingRules = [
  { pattern: /password/i, mask: '[REDACTED]' },
  { pattern: /token/i, mask: '[REDACTED]' },
  { pattern: /authorization/i, mask: '[REDACTED]' },
  { pattern: /email/i, mask: (v: string) => maskEmail(v) },
  { pattern: /phone/i, mask: (v: string) => maskPhone(v) },
  { pattern: /creditCard|cardNumber/i, mask: (v: string) => maskCard(v) },
];

function maskSensitiveData(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      const rule = maskingRules.find((r) => r.pattern.test(key));
      if (rule && value) {
        return typeof rule.mask === 'function' ? rule.mask(value) : rule.mask;
      }
      return value;
    }),
  );
}
```

**Log Sampling (High Traffic):**

| Log Level | Sampling Rate | Condition               |
| --------- | ------------- | ----------------------- |
| `error`   | 100%          | Always log              |
| `warn`    | 100%          | Always log              |
| `info`    | 100%          | Normal traffic          |
| `info`    | 10%           | > 1000 req/min          |
| `debug`   | 1%            | Production (if enabled) |

```typescript
// Adaptive log sampling
@Injectable()
class SampledLogger {
  private requestCount = 0;
  private lastReset = Date.now();

  log(level: string, message: string, context?: any) {
    // Always log errors/warnings
    if (level === 'error' || level === 'warn') {
      return this.logger.log(level, message, context);
    }

    // Sample info/debug under high load
    this.requestCount++;
    if (Date.now() - this.lastReset > 60000) {
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    const samplingRate = this.requestCount > 1000 ? 0.1 : 1.0;
    if (Math.random() < samplingRate) {
      this.logger.log(level, message, { ...context, sampled: true });
    }
  }
}
```

**Key Metrics to Monitor:**

| Metric                          | Type      | Alert Threshold |
| ------------------------------- | --------- | --------------- |
| `http_request_duration_seconds` | Histogram | p99 > 2s        |
| `http_requests_total`           | Counter   | Error rate > 1% |
| `db_connection_pool_size`       | Gauge     | > 80% utilized  |
| `db_query_duration_seconds`     | Histogram | p99 > 1s        |
| `cache_hit_ratio`               | Gauge     | < 80%           |
| `queue_depth`                   | Gauge     | > 1000 messages |
| `memory_usage_bytes`            | Gauge     | > 80% of limit  |
| `cpu_usage_percent`             | Gauge     | > 80% sustained |

**Distributed Tracing:**

| Span Type       | Attributes                                |
| --------------- | ----------------------------------------- |
| HTTP Request    | method, path, status, user_id             |
| Database Query  | operation, table, duration                |
| Cache Operation | operation, key_prefix, hit/miss           |
| External API    | service, endpoint, status                 |
| Queue Publish   | queue_name, message_type                  |
| Queue Consume   | queue_name, message_type, processing_time |

---

### 12.8 Deployment Strategy

**Environment Configuration:**

| Environment   | Purpose                | API replicas | Worker replicas | Scheduler replicas | Database                   |
| ------------- | ---------------------- | ------------ | --------------- | ------------------ | -------------------------- |
| `development` | Local development      | 1            | 1               | 1                  | SQLite / Docker PostgreSQL |
| `staging`     | Pre-production testing | 2+           | 2+              | 1                  | PostgreSQL (shared)        |
| `production`  | Live traffic           | 3+           | Load-dependent  | 1                  | PostgreSQL + Read Replicas |

**Runtime deployment rules:**

- Build one image containing all three compiled entrypoints.
- Run each entrypoint in a separate container/process with its own heap and event loop.
- Scale API and workers independently.
- Keep the scheduler at one replica to avoid duplicate cron publication.
- Do not expose worker or scheduler ports; they are Nest application contexts, not HTTP servers.
- Use the same Redis endpoint and `QUEUE_REALTIME_CHANNEL` across all runtimes.
- Apply per-runtime CPU/memory limits; containers on the same host still share host capacity.

**Deployment Methods:**

| Method         | Use Case               | Rollback Time |
| -------------- | ---------------------- | ------------- |
| **Rolling**    | Standard deployments   | 2-5 minutes   |
| **Blue-Green** | Zero-downtime required | Instant       |
| **Canary**     | Risk mitigation        | Instant       |

**Rolling Deployment Settings:**

| Setting           | Value | Purpose                  |
| ----------------- | ----- | ------------------------ |
| `maxSurge`        | 25%   | Extra pods during update |
| `maxUnavailable`  | 0     | Ensure availability      |
| `minReadySeconds` | 30    | Stability check          |

**CI/CD Pipeline Stages:**

| Stage                 | Actions                        | Gate                        |
| --------------------- | ------------------------------ | --------------------------- |
| **Build**             | Compile, lint, unit tests      | Tests pass                  |
| **Test**              | Integration tests, E2E tests   | Coverage > 80%              |
| **Security**          | SAST, dependency scan          | No critical vulnerabilities |
| **Build Image**       | Docker build, push to registry | Image scan pass             |
| **Deploy Staging**    | Deploy to staging              | Health check pass           |
| **Smoke Test**        | API smoke tests                | All critical paths pass     |
| **Deploy Production** | Canary → Full rollout          | Metrics healthy             |

**Database Migration Strategy:**

| Rule                    | Description                           |
| ----------------------- | ------------------------------------- |
| **Forward-only**        | Never modify deployed migrations      |
| **Backward compatible** | Old code must work with new schema    |
| **Separate deploy**     | Schema changes before code changes    |
| **Rollback plan**       | Every migration has a rollback script |

**Migration Deployment Order:**

| Step | Action                           | Rollback               |
| ---- | -------------------------------- | ---------------------- |
| 1    | Add new columns (nullable)       | Drop columns           |
| 2    | Deploy new code (writes to both) | Revert code            |
| 3    | Migrate data                     | Reverse data migration |
| 4    | Deploy code (reads from new)     | Revert code            |
| 5    | Drop old columns                 | N/A (data preserved)   |

---

### 12.9 Production Checklist

**Pre-Launch Checklist:**

| Category          | Item                                     | Status | Priority |
| ----------------- | ---------------------------------------- | ------ | -------- |
| **Security**      | HTTPS enforced (HSTS enabled)            | ▢      | Critical |
| **Security**      | Security headers configured (Helmet.js)  | ▢      | Critical |
| **Security**      | CORS properly configured                 | ▢      | Critical |
| **Security**      | Secrets in secure storage (Vault/AWS SM) | ▢      | Critical |
| **Security**      | Rate limiting enabled (Redis-based)      | ▢      | Critical |
| **Security**      | Input validation with whitelist          | ▢      | Critical |
| **Security**      | Request body size limits set             | ▢      | High     |
| **Security**      | SQL injection prevention verified        | ▢      | Critical |
| **Security**      | XSS prevention (sanitization)            | ▢      | Critical |
| **Security**      | CSRF protection (if applicable)          | ▢      | High     |
| **Security**      | Authentication/Authorization tested      | ▢      | Critical |
| **Security**      | JWT blacklist implemented                | ▢      | High     |
| **Security**      | Refresh token rotation enabled           | ▢      | High     |
| **Security**      | Sensitive data masking in logs           | ▢      | Critical |
| **Security**      | Dependency vulnerability scan passed     | ▢      | High     |
| **Database**      | Connection pooling configured            | ▢      | High     |
| **Database**      | Query timeouts set                       | ▢      | High     |
| **Database**      | Statement timeout configured             | ▢      | High     |
| **Database**      | Idle transaction timeout set             | ▢      | Medium   |
| **Database**      | Indexes optimized (EXPLAIN ANALYZE)      | ▢      | High     |
| **Database**      | Backup/Recovery tested                   | ▢      | Critical |
| **Database**      | Read replica routing (if applicable)     | ▢      | Medium   |
| **Resilience**    | Circuit breakers configured              | ▢      | High     |
| **Resilience**    | Retry policies with jitter               | ▢      | High     |
| **Resilience**    | Bulkhead isolation for critical paths    | ▢      | Medium   |
| **Resilience**    | Graceful shutdown implemented            | ▢      | High     |
| **Resilience**    | Health checks (live/ready/startup)       | ▢      | Critical |
| **Resilience**    | Deep health check endpoint               | ▢      | Medium   |
| **Observability** | Structured logging (JSON)                | ▢      | High     |
| **Observability** | Correlation ID propagation               | ▢      | High     |
| **Observability** | Log sampling for high traffic            | ▢      | Medium   |
| **Observability** | Metrics exported (Prometheus)            | ▢      | High     |
| **Observability** | Distributed tracing (OpenTelemetry)      | ▢      | Medium   |
| **Observability** | Alerting rules configured                | ▢      | High     |
| **Observability** | Error tracking (Sentry/etc)              | ▢      | High     |
| **Performance**   | Load testing completed (p99 < 2s)        | ▢      | High     |
| **Performance**   | Caching strategy implemented             | ▢      | High     |
| **Performance**   | CDN configured (static assets)           | ▢      | Medium   |
| **Performance**   | Response compression enabled             | ▢      | Medium   |
| **API**           | Consistent response envelope             | ▢      | High     |
| **API**           | i18n error messages                      | ▢      | Medium   |
| **API**           | API versioning strategy                  | ▢      | Medium   |
| **API**           | OpenAPI/Swagger documentation            | ▢      | Medium   |
| **Deployment**    | CI/CD pipeline tested                    | ▢      | Critical |
| **Deployment**    | Rollback procedure documented & tested   | ▢      | Critical |
| **Deployment**    | Environment configs validated            | ▢      | High     |
| **Deployment**    | Zero-downtime deployment verified        | ▢      | High     |
| **Deployment**    | Database migration strategy              | ▢      | High     |

**Post-Launch Monitoring (First 24-48 hours):**

| Metric             | Target  | Alert Threshold |
| ------------------ | ------- | --------------- |
| Error rate         | < 0.1%  | > 1%            |
| p99 latency        | < 2s    | > 3s            |
| Availability       | > 99.9% | < 99.5%         |
| Memory usage       | < 70%   | > 85%           |
| CPU usage          | < 70%   | > 85%           |
| DB connection pool | < 70%   | > 90%           |

---

## 13. Architecture Decision Records

### 13.1 ADR-001: Clean Architecture as Base

**Status:** Accepted

**Context:** Need a maintainable, testable architecture for long-term development.

**Decision:** Adopt Clean Architecture with strict layer boundaries.

**Consequences:**

- (+) High testability through dependency inversion
- (+) Framework independence for domain logic
- (-) More boilerplate code
- (-) Steeper learning curve

---

### 13.2 ADR-002: Modular Monolith over Microservices

**Status:** Accepted

**Context:** Starting new project, team size is small, domain boundaries unclear.

**Decision:** Start with Modular Monolith, design for future extraction.

**Consequences:**

- (+) Simpler deployment and operations
- (+) Easier refactoring while learning domain
- (+) Can extract to microservices later
- (-) Must enforce module boundaries manually

---

### 13.3 ADR-003: CQRS for Complex Domains Only

**Status:** Accepted

**Context:** CQRS adds complexity but provides benefits for read-heavy or complex domains.

**Decision:** Use simple CRUD for basic modules, CQRS when read/write models diverge.

**Consequences:**

- (+) Reduced complexity for simple features
- (+) Better performance where needed
- (-) Inconsistent patterns across modules

---

### 13.4 ADR-004: Domain Events for Module Communication

**Status:** Accepted

**Context:** Need loose coupling between feature modules.

**Decision:** Modules communicate via domain events, not direct service calls.

**Consequences:**

- (+) Loose coupling between modules
- (+) Easy to add new handlers
- (-) Eventual consistency considerations
- (-) Harder to trace execution flow

---

### 13.5 ADR-005: PostgreSQL as Primary Database

**Status:** Accepted

**Context:** Need reliable, scalable relational database with good TypeORM support.

**Decision:** Use PostgreSQL for all transactional data.

**Consequences:**

- (+) ACID compliance, mature ecosystem
- (+) JSON support for flexible schemas
- (+) Excellent performance with proper indexing
- (-) Requires more ops knowledge than SQLite/MySQL

---

### 13.6 ADR-006: Database Abstraction via Ports & Adapters

**Status:** Accepted

**Context:** Need flexibility to switch databases or ORMs in the future without rewriting business logic.

**Decision:** Strict separation between Domain entities and ORM entities, with all persistence access via repository interfaces (Ports).

**Key Rules:**

- Domain layer has ZERO knowledge of persistence technology
- ORM entities live only in Infrastructure layer
- Mappers handle all Domain ↔ ORM entity conversion
- Repository interfaces define contracts, implementations are swappable
- Transaction management abstracted via IUnitOfWork

**Consequences:**

- (+) Can switch SQL databases with minimal effort (config change)
- (+) Can switch ORMs (TypeORM → Prisma) by rewriting only Infrastructure
- (+) Can switch to NoSQL by implementing new adapters
- (+) Domain logic fully testable without database
- (-) More boilerplate (separate entities, mappers)
- (-) Slight performance overhead from mapping
- (-) Team must understand and enforce boundaries

---

### 13.7 ADR-007: Separate API, Worker, and Scheduler Runtimes

**Status:** Accepted

**Context:** Bull processors and cron providers originally ran inside every API process. This
coupled background load to request latency and caused every scaled API replica to register cron.

**Decision:** Build one image with three entrypoints and run them as separate processes:

- `main.ts` serves HTTP, GraphQL, and WebSocket traffic and publishes jobs.
- `main.worker.ts` consumes Bull queues and owns worker-only adapters.
- `main.scheduler.ts` registers cron providers and publishes scheduled jobs.

**Consequences:**

- (+) API and worker capacity scale independently.
- (+) CPU-heavy or slow jobs cannot block the API event loop.
- (+) A singleton scheduler prevents duplicate cron publication.
- (+) One immutable image is promoted across all runtime roles.
- (-) Redis becomes required runtime infrastructure.
- (-) Deployments must manage three process roles and their resource budgets.

---

## References

- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Domain-Driven Design - Eric Evans](https://www.domainlanguage.com/ddd/)
- [Implementing Domain-Driven Design - Vaughn Vernon](https://www.oreilly.com/library/view/implementing-domain-driven-design/9780133039900/)
