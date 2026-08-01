import type { EntityManager, Repository } from 'typeorm';
import {
  clearTypeOrmTransaction,
  createTransactionAwareRepository,
  enterTypeOrmTransaction,
} from './transaction-context.typeorm';

class TestEntity {
  id!: string;
}

describe('TypeORM transaction context', () => {
  afterEach(() => {
    clearTypeOrmTransaction();
  });

  it('routes repository calls to the active transaction manager', async () => {
    const rootFind = jest.fn().mockResolvedValue('root');
    const transactionFind = jest.fn().mockResolvedValue('transaction');
    const rootRepository = {
      target: TestEntity,
      findOne: rootFind,
    } as unknown as Repository<TestEntity>;
    const transactionRepository = {
      target: TestEntity,
      findOne: transactionFind,
    } as unknown as Repository<TestEntity>;
    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepository),
    } as unknown as EntityManager;
    const repository = createTransactionAwareRepository(rootRepository);

    await expect(repository.findOne({ where: { id: '1' } })).resolves.toBe('root');
    enterTypeOrmTransaction(manager);
    await expect(repository.findOne({ where: { id: '1' } })).resolves.toBe('transaction');
    clearTypeOrmTransaction();
    await expect(repository.findOne({ where: { id: '1' } })).resolves.toBe('root');
  });
});
