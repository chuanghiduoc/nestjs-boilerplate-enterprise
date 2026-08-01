import { Injectable, Inject, Scope } from '@nestjs/common';
import { DataSource, type QueryRunner } from 'typeorm';
import type {
  IUnitOfWork,
  IsolationLevel,
  TransactionOptions,
} from '@core/domain/ports/repositories';
import type { DomainEvent } from '@core/domain/base';
import { EVENT_BUS, type IEventBus } from '@core/domain/ports/services';
import { clearTypeOrmTransaction, enterTypeOrmTransaction } from './transaction-context.typeorm';

/**
 * TypeORM Unit of Work Implementation
 *
 * Manages transaction boundaries and domain event dispatch.
 * Scoped per request to ensure proper transaction isolation.
 *
 * Section 8.5: Transaction Management
 */
@Injectable({ scope: Scope.REQUEST })
export class TypeOrmUnitOfWork implements IUnitOfWork {
  private queryRunner: QueryRunner | null = null;
  private pendingEvents: DomainEvent[] = [];
  private transactionActive = false;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async beginTransaction(options?: TransactionOptions): Promise<void> {
    if (this.transactionActive) {
      throw new Error('Transaction already active');
    }

    this.queryRunner = this.dataSource.createQueryRunner();
    try {
      await this.queryRunner.connect();
      await this.queryRunner.startTransaction(this.mapIsolationLevel(options?.isolationLevel));
      enterTypeOrmTransaction(this.queryRunner.manager);
      this.transactionActive = true;
    } catch (error) {
      await this.queryRunner.release();
      this.queryRunner = null;
      throw error;
    }
  }

  async commit(): Promise<void> {
    if (!this.queryRunner || !this.transactionActive) {
      throw new Error('No active transaction to commit');
    }

    const events = this.getPendingEvents();
    try {
      await this.queryRunner.commitTransaction();
    } catch (error) {
      if (this.queryRunner.isTransactionActive) {
        await this.queryRunner.rollbackTransaction();
      }
      this.clearPendingEvents();
      throw error;
    } finally {
      await this.releaseQueryRunner();
    }

    // The database is committed before integration events are dispatched.
    // Clear first so a publication failure cannot duplicate events on reuse.
    this.clearPendingEvents();
    if (events.length > 0) {
      await this.eventBus.publishAll(events);
    }
  }

  async rollback(): Promise<void> {
    if (!this.queryRunner || !this.transactionActive) {
      throw new Error('No active transaction to rollback');
    }

    try {
      await this.queryRunner.rollbackTransaction();
      this.clearPendingEvents();
    } finally {
      await this.releaseQueryRunner();
    }
  }

  async executeInTransaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T> {
    await this.beginTransaction(options);

    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      // commit() may fail while publishing post-commit events, after the
      // database transaction has already been committed and released.
      if (this.transactionActive) {
        await this.rollback();
      }
      throw error;
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

  async createSavepoint(name: string): Promise<void> {
    if (!this.queryRunner || !this.transactionActive) {
      throw new Error('No active transaction for savepoint');
    }
    await this.queryRunner.query(`SAVEPOINT ${this.validateSavepointName(name)}`);
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    if (!this.queryRunner || !this.transactionActive) {
      throw new Error('No active transaction for savepoint rollback');
    }
    await this.queryRunner.query(`ROLLBACK TO SAVEPOINT ${this.validateSavepointName(name)}`);
  }

  async releaseSavepoint(name: string): Promise<void> {
    if (!this.queryRunner || !this.transactionActive) {
      throw new Error('No active transaction to release savepoint');
    }
    await this.queryRunner.query(`RELEASE SAVEPOINT ${this.validateSavepointName(name)}`);
  }

  /**
   * Get the query runner for repositories that need transaction-aware operations
   */
  getQueryRunner(): QueryRunner | null {
    return this.queryRunner;
  }

  private async releaseQueryRunner(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.release();
      this.queryRunner = null;
      this.transactionActive = false;
      clearTypeOrmTransaction();
    }
  }

  private mapIsolationLevel(
    level?: IsolationLevel,
  ): 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' | undefined {
    if (!level) {
      return undefined;
    }
    return level;
  }

  private validateSavepointName(name: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)) {
      throw new Error('Invalid savepoint name');
    }
    return name;
  }
}
