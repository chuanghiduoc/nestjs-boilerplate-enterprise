import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  IUnitOfWork,
  IsolationLevel,
  TransactionOptions,
} from '@core/domain/ports/repositories';
import type { DomainEvent } from '@core/domain/base';
import type { IEventBus } from '@core/domain/ports/services';

/**
 * Prisma Transaction Client Type
 * Represents the transaction client returned by $transaction
 */
export interface PrismaTransactionClient {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
}

/**
 * Prisma Client Type with Transaction Support
 */
export interface PrismaClientWithTransaction {
  $transaction: <T>(
    fn: (tx: PrismaTransactionClient) => Promise<T>,
    options?: { isolationLevel?: string; timeout?: number },
  ) => Promise<T>;
}

const transactionStorage = new AsyncLocalStorage<PrismaTransactionClient>();

/**
 * Routes model delegate access to Prisma's transaction client for the current
 * async request while retaining the root client outside a transaction.
 */
export function createTransactionAwarePrismaClient<TClient extends object>(
  client: TClient,
): TClient {
  return new Proxy(client, {
    get(target, property): unknown {
      const transactionClient = transactionStorage.getStore();
      const source =
        transactionClient && property in transactionClient ? transactionClient : target;
      const value: unknown = Reflect.get(source, property, source);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]): unknown => {
        const result: unknown = Reflect.apply(value, source, args);
        return result;
      };
    },
  });
}

/**
 * Prisma Unit of Work Implementation
 *
 * Manages transaction boundaries and domain event dispatch for Prisma.
 * Uses Prisma's interactive transactions.
 *
 * Section 8.5: Transaction Management
 *
 * Note: Prisma uses interactive transactions differently from TypeORM.
 * The transaction context is passed to the callback function.
 */
@Injectable({ scope: Scope.REQUEST })
export class PrismaUnitOfWork implements IUnitOfWork {
  private pendingEvents: DomainEvent[] = [];
  private transactionActive = false;
  private transactionClient: PrismaTransactionClient | null = null;

  constructor(
    private readonly prisma: PrismaClientWithTransaction,
    private readonly eventBus: IEventBus,
  ) {}

  /**
   * Note: Prisma doesn't support explicit beginTransaction.
   * Use executeInTransaction instead for transactional operations.
   */
  beginTransaction(_options?: TransactionOptions): Promise<void> {
    return Promise.reject(
      new Error('Prisma only supports callback transactions; use executeInTransaction()'),
    );
  }

  async commit(): Promise<void> {
    if (!this.transactionActive) {
      throw new Error('No active transaction to commit');
    }

    try {
      // Dispatch domain events after successful commit
      if (this.pendingEvents.length > 0) {
        await this.eventBus.publishAll(this.pendingEvents);
        this.clearPendingEvents();
      }
    } finally {
      this.transactionActive = false;
      this.transactionClient = null;
    }
  }

  rollback(): Promise<void> {
    if (!this.transactionActive) {
      return Promise.reject(new Error('No active transaction to rollback'));
    }

    this.clearPendingEvents();
    this.transactionActive = false;
    this.transactionClient = null;
    return Promise.resolve();
  }

  /**
   * Execute a function within a Prisma interactive transaction
   */
  async executeInTransaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T> {
    if (this.transactionActive) {
      throw new Error('Transaction already active');
    }

    const prismaOptions: { isolationLevel?: string; timeout?: number } = {};

    if (options?.isolationLevel) {
      prismaOptions.isolationLevel = this.mapIsolationLevel(options.isolationLevel);
    }

    if (options?.timeout) {
      prismaOptions.timeout = options.timeout;
    }

    try {
      this.transactionActive = true;

      const result = await this.prisma.$transaction(async (tx) => {
        this.transactionClient = tx;
        return transactionStorage.run(tx, fn);
      }, prismaOptions);

      // Dispatch domain events after successful commit
      if (this.pendingEvents.length > 0) {
        await this.eventBus.publishAll(this.pendingEvents);
        this.clearPendingEvents();
      }

      return result;
    } catch (error) {
      this.clearPendingEvents();
      throw error;
    } finally {
      this.transactionActive = false;
      this.transactionClient = null;
    }
  }

  addDomainEvents(events: DomainEvent[]): void {
    this.pendingEvents.push(...events);
  }

  getPendingEvents(): DomainEvent[] {
    return [...this.pendingEvents];
  }

  clearPendingEvents(): void {
    this.pendingEvents = [];
  }

  isTransactionActive(): boolean {
    return this.transactionActive;
  }

  /**
   * Get the transaction client for repositories
   */
  getTransactionClient(): PrismaTransactionClient | null {
    return this.transactionClient;
  }

  /**
   * Prisma doesn't support savepoints in the traditional sense.
   * Nested transactions are handled automatically.
   */
  createSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      new Error('Prisma does not support explicit savepoints. Use nested transactions.'),
    );
  }

  rollbackToSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      new Error('Prisma does not support explicit savepoints. Use nested transactions.'),
    );
  }

  releaseSavepoint(_name: string): Promise<void> {
    return Promise.reject(
      new Error('Prisma does not support explicit savepoints. Use nested transactions.'),
    );
  }

  private mapIsolationLevel(level: IsolationLevel): string {
    const mapping: Record<IsolationLevel, string> = {
      'READ COMMITTED': 'ReadCommitted',
      'REPEATABLE READ': 'RepeatableRead',
      SERIALIZABLE: 'Serializable',
    };
    return mapping[level] || 'ReadCommitted';
  }
}
