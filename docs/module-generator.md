# Module Generator

Guide for generating new modules using Hygen code generator.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Generated Files](#generated-files)
4. [Customizing Templates](#customizing-templates)
5. [Examples](#examples)

---

## Overview

This boilerplate uses [Hygen](https://www.hygen.io/) for code generation. Hygen generates complete DDD modules following Clean Architecture patterns.

### Benefits

- **Consistency** - All modules follow the same structure
- **Speed** - Generate complete module in seconds
- **Best Practices** - Templates follow established patterns
- **Multi-Database** - Generates TypeORM, Prisma, and Mongoose files

---

## Quick Start

### Generate Complete Module

```bash
pnpm generate:module
```

You'll be prompted for:

- **Module name** - e.g., `product`, `order`, `category`
- **Description** - Brief description of the module

### Example

```bash
$ pnpm generate:module

? Module name: product
? Description: Product catalog management

Generating files...
✓ Created: src/modules/product/product.module.ts
✓ Created: src/modules/product/domain/entities/product.entity.ts
✓ Created: src/modules/product/domain/repositories/product.repository.interface.ts
✓ Created: src/modules/product/application/use-cases/create-product.use-case.ts
✓ Created: src/modules/product/application/use-cases/get-product.use-case.ts
✓ Created: src/modules/product/application/use-cases/list-products.use-case.ts
✓ Created: src/modules/product/application/use-cases/update-product.use-case.ts
✓ Created: src/modules/product/application/use-cases/delete-product.use-case.ts
✓ Created: src/modules/product/presentation/controllers/product.controller.ts
✓ Created: src/modules/product/presentation/dtos/create-product.dto.ts
✓ Created: src/infrastructure/persistence/typeorm/entities/product.entity.ts
✓ Created: src/infrastructure/persistence/typeorm/repositories/product.repository.ts
✓ Created: src/infrastructure/persistence/mongoose/schemas/product.schema.ts
✓ Created: src/infrastructure/persistence/mongoose/repositories/product.repository.ts
✓ Created: src/infrastructure/persistence/prisma/repositories/product.repository.ts

Done! Module 'product' created successfully.
```

---

## Generated Files

### Module Structure

```
src/modules/product/
├── product.module.ts              # NestJS module
├── index.ts                       # Barrel export
│
├── domain/
│   ├── entities/
│   │   ├── product.entity.ts      # Domain entity
│   │   └── index.ts
│   ├── repositories/
│   │   ├── product.repository.interface.ts  # Repository interface
│   │   └── index.ts
│   ├── events/
│   │   ├── product-created.event.ts
│   │   ├── product-updated.event.ts
│   │   ├── product-deleted.event.ts
│   │   └── index.ts
│   └── index.ts
│
├── application/
│   ├── use-cases/
│   │   ├── create-product.use-case.ts
│   │   ├── get-product.use-case.ts
│   │   ├── list-products.use-case.ts
│   │   ├── update-product.use-case.ts
│   │   ├── delete-product.use-case.ts
│   │   └── index.ts
│   └── index.ts
│
└── presentation/
    ├── controllers/
    │   ├── product.controller.ts   # REST controller
    │   └── index.ts
    ├── dtos/
    │   ├── create-product.dto.ts
    │   ├── update-product.dto.ts
    │   ├── product-response.dto.ts
    │   └── index.ts
    └── index.ts
```

### Infrastructure Files

```
src/infrastructure/persistence/
├── typeorm/
│   ├── entities/
│   │   └── product.entity.ts      # TypeORM entity
│   └── repositories/
│       └── product.repository.ts  # TypeORM repository
│
├── mongoose/
│   ├── schemas/
│   │   └── product.schema.ts      # Mongoose schema
│   └── repositories/
│       └── product.repository.ts  # Mongoose repository
│
└── prisma/
    └── repositories/
        └── product.repository.ts  # Prisma repository
```

---

## File Details

### Domain Entity

```typescript
// src/modules/product/domain/entities/product.entity.ts
import { AggregateRoot } from '@core/domain/base';
import { ProductCreatedEvent } from '../events/product-created.event';

export interface ProductProps {
  name: string;
  description?: string;
  tenantId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Product extends AggregateRoot {
  private _name: string;
  private _description?: string;
  private _tenantId: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(id: string, props: ProductProps) {
    super(id);
    this._name = props.name;
    this._description = props.description;
    this._tenantId = props.tenantId;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // Factory method for creating new products
  static create(props: ProductProps): Product {
    const id = crypto.randomUUID();
    const product = new Product(id, props);
    product.addDomainEvent(new ProductCreatedEvent(product));
    return product;
  }

  // Factory method for reconstituting from persistence
  static reconstitute(id: string, props: ProductProps): Product {
    return new Product(id, props);
  }

  // Getters
  get name(): string {
    return this._name;
  }
  get description(): string | undefined {
    return this._description;
  }
  get tenantId(): string {
    return this._tenantId;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  updateName(name: string): void {
    this._name = name;
    this._updatedAt = new Date();
  }
}
```

### Repository Interface

```typescript
// src/modules/product/domain/repositories/product.repository.interface.ts
import { IRepository } from '@core/domain/ports/repositories';
import { Product } from '../entities/product.entity';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductFilterCriteria {
  name?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface IProductRepository extends IRepository<Product, string, ProductFilterCriteria> {
  findByName(name: string, tenantId: string): Promise<Product | null>;
  findByTenant(tenantId: string): Promise<Product[]>;
}
```

### Use Case

```typescript
// src/modules/product/application/use-cases/create-product.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { Product } from '../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  IProductRepository,
} from '../../domain/repositories/product.repository.interface';

export interface CreateProductInput {
  name: string;
  description?: string;
  tenantId: string;
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    // Check if product with same name exists
    const existing = await this.productRepository.findByName(input.name, input.tenantId);

    if (existing) {
      throw new Error('Product with this name already exists');
    }

    // Create domain entity
    const product = Product.create({
      name: input.name,
      description: input.description,
      tenantId: input.tenantId,
    });

    // Persist and return
    return this.productRepository.save(product);
  }
}
```

### Controller

```typescript
// src/modules/product/presentation/controllers/product.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case';
import { DeleteProductUseCase } from '../../application/use-cases/delete-product.use-case';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  async create(@Body() dto: CreateProductDto) {
    return this.createProductUseCase.execute(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    return this.getProductUseCase.execute(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all products' })
  async findAll(@Query() query: any) {
    return this.listProductsUseCase.execute(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.updateProductUseCase.execute({ id, ...dto });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  async remove(@Param('id') id: string) {
    return this.deleteProductUseCase.execute(id);
  }
}
```

---

## Customizing Templates

Templates are located in `_templates/module/new/`:

```
_templates/module/new/
├── module.ts.ejs.t                    # Module file
├── index.ts.ejs.t                     # Barrel export
├── domain-entity.ts.ejs.t             # Domain entity
├── domain-repository-interface.ts.ejs.t
├── domain-event-created.ts.ejs.t
├── domain-event-updated.ts.ejs.t
├── domain-event-deleted.ts.ejs.t
├── application-create-usecase.ts.ejs.t
├── application-get-usecase.ts.ejs.t
├── application-list-usecase.ts.ejs.t
├── application-update-usecase.ts.ejs.t
├── application-delete-usecase.ts.ejs.t
├── presentation-controller.ts.ejs.t
├── presentation-dto.ts.ejs.t
├── infra-entity.ts.ejs.t              # TypeORM entity
├── infra-repository.ts.ejs.t          # TypeORM repository
├── infra-mongoose-schema.ts.ejs.t     # Mongoose schema
├── infra-mongoose-repository.ts.ejs.t # Mongoose repository
├── infra-prisma-repository.ts.ejs.t   # Prisma repository
└── inject-*.ts.ejs.t                  # Index file injectors
```

### Template Syntax

Templates use [EJS](https://ejs.co/) syntax:

```typescript
// Example: module.ts.ejs.t
---
to: src/modules/<%= name %>/<%= name %>.module.ts
---
import { Module } from '@nestjs/common';
import { <%= h.changeCase.pascal(name) %>Controller } from './presentation/controllers/<%= name %>.controller';
import { Create<%= h.changeCase.pascal(name) %>UseCase } from './application/use-cases/create-<%= name %>.use-case';

@Module({
  controllers: [<%= h.changeCase.pascal(name) %>Controller],
  providers: [
    Create<%= h.changeCase.pascal(name) %>UseCase,
    // ... other use cases
  ],
})
export class <%= h.changeCase.pascal(name) %>Module {}
```

### Available Helpers

| Helper                        | Input         | Output         |
| ----------------------------- | ------------- | -------------- |
| `h.changeCase.pascal(name)`   | `product`     | `Product`      |
| `h.changeCase.camel(name)`    | `product`     | `product`      |
| `h.changeCase.constant(name)` | `product`     | `PRODUCT`      |
| `h.changeCase.snake(name)`    | `productItem` | `product_item` |
| `h.changeCase.kebab(name)`    | `productItem` | `product-item` |

---

## Examples

### Generate E-Commerce Modules

```bash
# Product catalog
pnpm generate:module
# name: product
# description: Product catalog management

# Order management
pnpm generate:module
# name: order
# description: Order processing and management

# Cart
pnpm generate:module
# name: cart
# description: Shopping cart functionality

# Payment
pnpm generate:module
# name: payment
# description: Payment processing
```

### Register Module in AppModule

After generating, add the module to `app.module.ts`:

```typescript
// src/app.module.ts
import { ProductModule } from './modules/product';

@Module({
  imports: [
    // ... other modules
    ProductModule,
  ],
})
export class AppModule {}
```

### Add to Database Module

If using TypeORM, register the entity in the database module:

```typescript
// src/infrastructure/persistence/typeorm/database.module.ts
import { ProductEntity } from './entities/product.entity';
import { TypeOrmProductRepository } from './repositories/product.repository';
import { PRODUCT_REPOSITORY } from '@modules/product/domain/repositories';

// Add to entities array
TypeOrmModule.forFeature([
  // ... existing entities
  ProductEntity,
])

// Add repository provider
{
  provide: PRODUCT_REPOSITORY,
  useClass: TypeOrmProductRepository,
}
```

---

## Other Generators

### Generate Entity Only

```bash
pnpm generate:entity
```

Creates only the domain entity without the full module structure.

### Generate Use Case Only

```bash
pnpm generate:usecase
```

Creates a single use case file.

---

## Best Practices

1. **Use singular names** - `product` not `products`
2. **Use lowercase** - `product` not `Product`
3. **Be descriptive** - Good descriptions help documentation
4. **Review generated code** - Templates provide a starting point; customize as needed
5. **Add tests** - Generate test files alongside production code
