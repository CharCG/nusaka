import { Injectable, NotFoundException } from '@nestjs/common';
import { UserStatsService } from '../user-stats/user-stats.service.js';
import { getActivityDayIndex } from '../../common/utils/activity-day.js';
import type { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class StreaksService {
  constructor(private readonly userStatsService: UserStatsService) {}

  async recordActivity(tx: Prisma.TransactionClient, userId: string) {
    const { stats, now } = await this.evaluateClosedDays(tx, userId);

    if (stats.lastStreakActivityAt && getActivityDayIndex(stats.lastStreakActivityAt) >= getActivityDayIndex(now)) {
      return {
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
      };
    }

    const currentStreak = stats.currentStreak + 1;

    return tx.userStats.update({
      where: { userId },
      data: {
        currentStreak,
        longestStreak: Math.max(stats.longestStreak, currentStreak),
        lastStreakActivityAt: now,
      },
      select: {
        currentStreak: true,
        longestStreak: true,
      },
    });
  }

  async refreshStreak(tx: Prisma.TransactionClient, userId: string) {
    const { stats } = await this.evaluateClosedDays(tx, userId);

    return {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
    };
  }

  private async evaluateClosedDays(tx: Prisma.TransactionClient, userId: string) {
    const stats = await this.userStatsService.lockStats(tx, userId);

    const now = new Date();
    const currentDay = getActivityDayIndex(now);
    const lastActivityDay = stats.lastStreakActivityAt ? getActivityDayIndex(stats.lastStreakActivityAt) : null;
    const evaluatedDay = stats.lastStreakEvaluatedAt ? getActivityDayIndex(stats.lastStreakEvaluatedAt) : null;

    if (evaluatedDay !== null && evaluatedDay >= currentDay) {
      return { stats, now };
    }

    const firstDay = evaluatedDay ?? lastActivityDay ?? currentDay;
    const closedDays = Math.max(0, currentDay - firstDay);
    const activityInRange = lastActivityDay !== null && lastActivityDay >= firstDay && lastActivityDay < currentDay;
    const missedDays = closedDays - (activityInRange ? 1 : 0);

    let currentStreak = stats.currentStreak;

    if (currentStreak > 0 && missedDays > 0) {
      const [inventory] = await tx.$queryRaw<{ streakFreeze: number }[]>`
        SELECT "streakFreeze"
        FROM "UserInventory"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `;

      if (!inventory) {
        throw new NotFoundException('User inventory not found');
      }

      const freezesUsed = Math.min(missedDays, inventory.streakFreeze);

      if (freezesUsed > 0) {
        await tx.userInventory.update({
          where: { userId },
          data: { streakFreeze: { decrement: freezesUsed } },
        });
      }

      if (freezesUsed < missedDays) {
        currentStreak = 0;
      }
    }

    await tx.userStats.update({
      where: { userId },
      data: {
        currentStreak,
        lastStreakEvaluatedAt: now,
      },
    });

    return {
      stats: { ...stats, currentStreak, lastStreakEvaluatedAt: now },
      now,
    };
  }
}
