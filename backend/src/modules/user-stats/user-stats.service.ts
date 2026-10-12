import { Injectable, NotFoundException } from '@nestjs/common';
import { getActivityDayIndex } from '../../common/utils/activity-day.js';
import type { Prisma } from '../../generated/prisma/client.js';

const DAILY_RECOVERY_LIVES = 5;
const MAX_RECOVERY_LIVES = 25;

@Injectable()
export class UserStatsService {
  async lockStats(tx: Prisma.TransactionClient, userId: string) {
    const [stats] = await tx.$queryRaw<
      {
        lives: number;
        lastLivesRecoveredAt: Date;
        currentStreak: number;
        longestStreak: number;
        lastStreakActivityAt: Date | null;
        lastStreakEvaluatedAt: Date | null;
      }[]
    >`
      SELECT
        "lives",
        "lastLivesRecoveredAt",
        "currentStreak",
        "longestStreak",
        "lastStreakActivityAt",
        "lastStreakEvaluatedAt"
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
    const currentDay = getActivityDayIndex(now);
    const lastRecoveryDay = getActivityDayIndex(stats.lastLivesRecoveredAt);
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
