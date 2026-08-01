import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';

const transactionStorage = new AsyncLocalStorage<EntityManager | undefined>();

export function enterTypeOrmTransaction(manager: EntityManager): void {
  transactionStorage.enterWith(manager);
}

export function clearTypeOrmTransaction(): void {
  transactionStorage.enterWith(undefined);
}

/**
 * Returns a stable repository proxy whose operations are routed to the
 * transaction-local EntityManager when a unit of work is active.
 */
export function createTransactionAwareRepository<T extends ObjectLiteral>(
  repository: Repository<T>,
): Repository<T> {
  return new Proxy(repository, {
    get(target, property): unknown {
      const activeRepository =
        transactionStorage.getStore()?.getRepository<T>(target.target) ?? target;
      const value: unknown = Reflect.get(activeRepository, property, activeRepository);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]): unknown => {
        const result: unknown = Reflect.apply(value, activeRepository, args);
        return result;
      };
    },
  });
}
