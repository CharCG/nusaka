import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

import * as crypto from 'crypto';

interface IdempotencyOptions {
  userId: string;
  key: string;
  operation: string;
  request: Prisma.JsonValue;
  execute: (tx: Prisma.TransactionClient) => Promise<Prisma.JsonValue>;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prismaService: PrismaService) {}

  async run(options: IdempotencyOptions): Promise<Prisma.JsonValue> {
    if (typeof options.key !== 'string' || !options.key.trim() || options.key.length > 255) {
      throw new BadRequestException('Invalid Idempotency-Key');
    }

    const requestHash = this.hashRequest(options.operation, options.request);
    const where = {
      userId_key: {
        userId: options.userId,
        key: options.key,
      },
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prismaService.$transaction(
          async (tx) => {
            const { count } = await tx.idempotencyRecord.createMany({
              data: {
                userId: options.userId,
                key: options.key,
                requestHash,
                response: {},
              },
              skipDuplicates: true,
            });

            if (count === 0) {
              const record = await tx.idempotencyRecord.findUniqueOrThrow({
                where,
              });

              if (record.requestHash !== requestHash) {
                throw new ConflictException('Idempotency-Key already used for a different request');
              }

              return record.response;
            }

            const response = await options.execute(tx);

            const record = await tx.idempotencyRecord.update({
              where,
              data: { response: response === null ? Prisma.JsonNull : response },
              select: { response: true },
            });

            return record.response;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        );
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') {
          throw error;
        }

        if (attempt === 2) {
          throw new ServiceUnavailableException('Retry with the same Idempotency-Key.');
        }
      }
    }

    throw new ServiceUnavailableException('Unable to process request');
  }

  private hashRequest(operation: string, request: Prisma.JsonValue): string {
    const serialized = JSON.stringify({ operation, request }, (_key, value: unknown) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
      }

      return value;
    });

    return crypto.createHash('sha256').update(serialized).digest('hex');
  }
}
