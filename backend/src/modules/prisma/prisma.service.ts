import { ConflictException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 25;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runSerializableTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = DEFAULT_MAX_RETRIES,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw new ConflictException('Request conflict');
        }

        const backoffMs = BASE_BACKOFF_MS * 3 ** attempt + Math.floor(Math.random() * BASE_BACKOFF_MS);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new ConflictException('Request conflict');
  }
}
