import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_RECOVERY_LIVES = 5;
const MAX_RECOVERY_LIVES = 25;

@Injectable()
export class UserStatsService {
  constructor(private readonly prismaService: PrismaService) {}

  async lockStats(tx: Prisma.TransactionClient, userId: string) {
    const [stats] = await tx.$queryRaw<
      {
        lives: number;
        lastLivesRecoveredAt: Date;
      }[]
    >`
      SELECT "lives", "lastLivesRecoveredAt"
      FROM "UserStats"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `;

    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    return stats;
  }

  async recoverLives(tx: Prisma.TransactionClient, userId: string) {
    const stats = await this.lockStats(tx, userId);
    const now = new Date();

    const currentDay = Math.floor(now.getTime() / DAY_MS);
    const lastRecoveryDay = Math.floor(stats.lastLivesRecoveredAt.getTime() / DAY_MS);
    const elapsedDays = currentDay - lastRecoveryDay;

    if (elapsedDays <= 0) {
      return { lives: stats.lives };
    }

    const recoveredLives = Math.max(0, Math.min(MAX_RECOVERY_LIVES - stats.lives, elapsedDays * DAILY_RECOVERY_LIVES));

    return tx.userStats.update({
      where: { userId },
      data: {
        lives: { increment: recoveredLives },
        lastLivesRecoveredAt: now,
      },
      select: { lives: true },
    });
  }
}
