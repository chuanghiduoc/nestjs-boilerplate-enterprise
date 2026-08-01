import {
  createTransactionAwarePrismaClient,
  PrismaUnitOfWork,
  type PrismaClientWithTransaction,
  type PrismaTransactionClient,
} from './unit-of-work.prisma';

describe('PrismaUnitOfWork', () => {
  it('routes delegate calls through the transaction client', async () => {
    const rootFind = jest.fn((_args: { where: { id: string } }): Promise<string> =>
      Promise.resolve('root'),
    );
    const transactionFind = jest.fn((_args: { where: { id: string } }): Promise<string> =>
      Promise.resolve('transaction'),
    );
    const transactionClient = {
      user: { findUnique: transactionFind },
    } as unknown as PrismaTransactionClient;
    const rawClient = {
      user: { findUnique: rootFind },
      $transaction: jest.fn(async (callback: (tx: PrismaTransactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    };
    const client = createTransactionAwarePrismaClient(rawClient);
    const eventBus = { publishAll: jest.fn() };
    const unitOfWork = new PrismaUnitOfWork(rawClient as PrismaClientWithTransaction, eventBus);

    await expect(
      unitOfWork.executeInTransaction(() => client.user.findUnique({ where: { id: '1' } })),
    ).resolves.toBe('transaction');
    expect(transactionFind).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(rootFind).not.toHaveBeenCalled();
  });
});
