import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { STREAK_PROCESS_CRON } from './streaks.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { Cron } from '@nestjs/schedule';
import { DAY_MS, utcDay } from '../../common/utils/day.util.js';

@Injectable()
export class StreaksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StreaksService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onApplicationBootstrap() {
    await this.processMissedDays();
  }

  async recordStreakActivity(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
    const today = utcDay(now);

    const stats = await this.reconcileMissedDays(tx, userId, today);

    if (stats.lastStreakDate && stats.lastStreakDate.getTime() >= today.getTime()) {
      return;
    }

    const currentStreak = stats.currentStreak + 1;

    await tx.userStats.update({
      where: { userId },
      data: {
        currentStreak,
        longestStreak: Math.max(stats.longestStreak, currentStreak),
        lastStreakDate: today,
      },
    });
  }

  @Cron(STREAK_PROCESS_CRON, {
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async processMissedDays() {
    try {
      const today = utcDay(new Date());
      const yesterday = new Date(today.getTime() - DAY_MS);

      const users = await this.prismaService.userStats.findMany({
        where: {
          currentStreak: { gt: 0 },
          lastStreakDate: { lt: yesterday },
        },
        select: { userId: true },
      });

      for (const { userId } of users) {
        try {
          await this.prismaService.$transaction(
            async (tx) => {
              await this.reconcileMissedDays(tx, userId, utcDay(new Date()));
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
        } catch (error) {
          this.logger.error(
            `Unable to process streak for user ${userId}, retry on the next scheduled run`,
            error instanceof Error ? (error.stack ?? error.message) : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Unable to process daily streaks, retry on the next scheduled run',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    }
  }

  private async reconcileMissedDays(tx: Prisma.TransactionClient, userId: string, today: Date) {
    const stats = await tx.userStats.findUniqueOrThrow({
      where: { userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastStreakDate: true,
      },
    });

    if (!stats.lastStreakDate || stats.currentStreak === 0) {
      return stats;
    }

    const elapsedDays = Math.round((today.getTime() - stats.lastStreakDate.getTime()) / DAY_MS);

    if (elapsedDays <= 1) {
      return stats;
    }

    const missedDays = elapsedDays - 1;

    const inventory = await tx.userInventory.findUniqueOrThrow({
      where: { userId },
      select: { streakFreeze: true },
    });

    const freezesUsed = Math.min(missedDays, inventory.streakFreeze);

    if (freezesUsed > 0) {
      await tx.userInventory.update({
        where: { userId },
        data: {
          streakFreeze: { decrement: freezesUsed },
        },
      });
    }

    const streakPreserved = freezesUsed === missedDays;

    return tx.userStats.update({
      where: { userId },
      data: {
        currentStreak: streakPreserved ? stats.currentStreak : 0,
        lastStreakDate: new Date(today.getTime() - DAY_MS),
      },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastStreakDate: true,
      },
    });
  }
}
