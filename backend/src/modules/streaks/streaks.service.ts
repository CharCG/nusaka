import { ConflictException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '../../generated/prisma/client.js';
import { elapsedUtcDays, previousUtcDay, utcDay } from '../../common/utils/day.util.js';

@Injectable()
export class StreaksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StreaksService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onApplicationBootstrap() {
    await this.processMissedDays();
  }

  @Cron('0 0 * * * *', {
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async processMissedDays() {
    const now = new Date();
    const yesterday = previousUtcDay(now);

    try {
      const users = await this.prismaService.userStats.findMany({
        where: {
          currentStreak: { gt: 0 },
          OR: [
            { lastStreakDate: null },
            { lastStreakDate: { lt: yesterday } },
          ],
        },
        select: { userId: true },
      });

      for (const { userId } of users) {
        try {
          await this.prismaService.withTransactionRetry((tx) => this.syncStreak(tx, userId, now));
        } catch (error) {
          this.logger.error(
            `Streak processing failed for user ${userId}`,
            error instanceof Error ? (error.stack ?? error.message) : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Streak processing failed, the next scheduled run will retry',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    }
  }

  async recordActivity(tx: Prisma.TransactionClient, userId: string, now: Date) {
    await this.updateStreak(tx, userId, true, now);
  }

  async syncStreak(tx: Prisma.TransactionClient, userId: string, now: Date) {
    await this.updateStreak(tx, userId, false, now);
  }

  private async updateStreak(tx: Prisma.TransactionClient, userId: string, hasActivity: boolean, now: Date) {
    const today = utcDay(now);

    const stats = await tx.userStats.findUniqueOrThrow({
      where: { userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastStreakDate: true,
      },
    });

    if (stats.currentStreak > 0 && stats.lastStreakDate === null) {
      throw new Error('An active streak requires lastStreakDate');
    }

    const elapsedDays = stats.lastStreakDate ? elapsedUtcDays(stats.lastStreakDate, today) : null;

    if (elapsedDays !== null && elapsedDays < 0) {
      throw new ConflictException('The activity day changed, retry the request');
    }

    if (hasActivity && elapsedDays === 0) {
      return;
    }

    if (!hasActivity && (elapsedDays === null || elapsedDays <= 1 || stats.currentStreak === 0)) {
      return;
    }

    const missedDays = elapsedDays === null ? 0 : Math.max(0, elapsedDays - 1);

    let freezesUsed = 0;

    if (missedDays > 0 && stats.currentStreak > 0) {
      const inventory = await tx.userInventory.findUniqueOrThrow({
        where: { userId },
        select: { streakFreeze: true },
      });

      freezesUsed = Math.min(missedDays, inventory.streakFreeze);

      if (freezesUsed > 0) {
        await tx.userInventory.update({
          where: { userId },
          data: {
            streakFreeze: {
              decrement: freezesUsed,
            },
          },
        });
      }
    }

    const streakPreserved = freezesUsed === missedDays;

    const baseStreak = streakPreserved ? stats.currentStreak : 0;

    const currentStreak = hasActivity ? baseStreak + 1 : baseStreak;

    await tx.userStats.update({
      where: { userId },
      data: {
        currentStreak,
        longestStreak: Math.max(stats.longestStreak, currentStreak),
        lastStreakDate: hasActivity ? today : previousUtcDay(today),
      },
    });
  }
}
