import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DAILY_REWARD_ENERGY, DAILY_REWARD_MAX_GEMS, DAILY_REWARD_MIN_GEMS } from './rewards.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { DAY_MS, utcDay } from '../../common/utils/day.util.js';

@Injectable()
export class RewardsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getDailyRewardStatus(userId: string) {
    const stats = await this.prismaService.userStats.findUnique({
      where: { userId },
      select: { lastDailyRewardDate: true },
    });

    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    const today = utcDay(new Date());
    const isClaimedToday = stats.lastDailyRewardDate !== null && stats.lastDailyRewardDate.getTime() >= today.getTime();
    const nextAvailableAt = new Date(today.getTime() + DAY_MS);

    return {
      isAvailable: !isClaimedToday,
      lastClaimedAt: stats.lastDailyRewardDate,
      nextAvailableAt: isClaimedToday ? nextAvailableAt : today,
    };
  }

  async claimDailyReward(userId: string) {
    return this.prismaService.$transaction(
      async (tx) => {
        const stats = await tx.userStats.findUnique({
          where: { userId },
          select: { lastDailyRewardDate: true },
        });

        if (!stats) {
          throw new NotFoundException('User stats not found');
        }

        const today = utcDay(new Date());

        if (stats.lastDailyRewardDate && stats.lastDailyRewardDate.getTime() >= today.getTime()) {
          throw new ConflictException('Daily reward already claimed');
        }

        const energyReward = DAILY_REWARD_ENERGY;
        const gemsReward = Math.floor(Math.random() * (DAILY_REWARD_MAX_GEMS - DAILY_REWARD_MIN_GEMS + 1)) + DAILY_REWARD_MIN_GEMS;

        const updatedStats = await tx.userStats.update({
          where: { userId },
          data: {
            lastDailyRewardDate: today,
            energy: { increment: energyReward },
            gems: { increment: gemsReward },
          },
          select: {
            xp: true,
            energy: true,
            gems: true,
            currentStreak: true,
            lastDailyRewardDate: true,
          },
        });

        return {
          rewards: {
            energy: energyReward,
            gems: gemsReward,
          },
          stats: updatedStats,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
