import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

function createPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: '7.10.0',
  });
}

function createPrismaMock($transaction: ReturnType<typeof vi.fn>) {
  return Object.assign(Object.create(PrismaService.prototype) as PrismaService, {
    $transaction,
  });
}

describe('PrismaService.runSerializableTransaction', () => {
  it('returns the transaction result on first attempt', async () => {
    const $transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
    const prisma = createPrismaMock($transaction);

    const result = await prisma.runSerializableTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect($transaction).toHaveBeenCalledTimes(1);
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('retries on P2034 and succeeds when a retry passes', async () => {
    const $transaction = vi
      .fn()
      .mockRejectedValueOnce(createPrismaError('P2034'))
      .mockRejectedValueOnce(createPrismaError('P2034'))
      .mockResolvedValueOnce('recovered');
    const prisma = createPrismaMock($transaction);

    const result = await prisma.runSerializableTransaction(async () => 'recovered', 3);

    expect(result).toBe('recovered');
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it('throws ConflictException after exhausting P2034 retries', async () => {
    const $transaction = vi.fn().mockRejectedValue(createPrismaError('P2034'));
    const prisma = createPrismaMock($transaction);

    await expect(prisma.runSerializableTransaction(async () => 'never', 2)).rejects.toThrow(ConflictException);
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-retryable errors immediately without retrying', async () => {
    const $transaction = vi.fn().mockRejectedValue(new BadRequestException('Invalid'));
    const prisma = createPrismaMock($transaction);

    await expect(prisma.runSerializableTransaction(async () => 'never', 3)).rejects.toThrow(BadRequestException);
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
