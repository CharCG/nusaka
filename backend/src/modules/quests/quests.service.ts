import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { getQuestPeriod } from './quests.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, type QuestMetric } from '../../generated/prisma/client.js';

@Injectable()
export class QuestsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findQuests(userId: string) {
    const now = new Date();

    const quests = await this.prismaService.quest.findMany({
      where: { isActive: true },
      orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        period: true,
        target: true,
        rewardXp: true,
        rewardGems: true,
        rewardEnergy: true,
      },
    });

    const periods = quests.map((quest) => getQuestPeriod(quest.period, now));

    const userQuests = await this.prismaService.userQuest.findMany({
      where: {
        userId,
        questId: { in: quests.map((quest) => quest.id) },
        periodStart: { in: periods.map((period) => period.start) },
      },
      select: {
        questId: true,
        periodStart: true,
        progress: true,
        claimedAt: true,
      },
    });

    const userQuestByKey = new Map(
      userQuests.map((userQuest) => [`${userQuest.questId}:${userQuest.periodStart.getTime()}`, userQuest]),
    );

    return quests.map((quest, index) => {
      const period = periods[index];
      const userQuest = userQuestByKey.get(`${quest.id}:${period.start.getTime()}`);
      const progress = Math.min(userQuest?.progress ?? 0, quest.target);

      return {
        ...quest,
        progress,
        isCompleted: progress >= quest.target,
        isClaimed: userQuest?.claimedAt != null,
        resetsAt: period.end,
      };
    });
  }

  async claimQuest(userId: string, questId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const quest = await tx.quest.findUnique({
        where: { id: questId },
        select: {
          id: true,
          period: true,
          target: true,
          rewardXp: true,
          rewardGems: true,
          rewardEnergy: true,
          isActive: true,
        },
      });

      if (!quest || !quest.isActive) {
        throw new NotFoundException('Quest not found');
      }

      const now = new Date();
      const { start: periodStart } = getQuestPeriod(quest.period, now);

      const userQuest = await tx.userQuest.findUnique({
        where: {
          userId_questId_periodStart: {
            userId,
            questId,
            periodStart,
          },
        },
        select: {
          progress: true,
          claimedAt: true,
        },
      });

      if (!userQuest || userQuest.progress < quest.target) {
        throw new BadRequestException('Quest not completed');
      }

      const claimed = await tx.userQuest.updateMany({
        where: {
          userId,
          questId,
          periodStart,
          claimedAt: null,
        },
        data: { claimedAt: now },
      });

      if (claimed.count === 0) {
        throw new ConflictException('Quest already claimed');
      }

      const stats = await tx.userStats.update({
        where: { userId },
        data: {
          xp: { increment: quest.rewardXp },
          gems: { increment: quest.rewardGems },
          energy: { increment: quest.rewardEnergy },
        },
        select: {
          xp: true,
          gems: true,
          energy: true,
        },
      });

      return {
        questId,
        rewardXp: quest.rewardXp,
        rewardGems: quest.rewardGems,
        rewardEnergy: quest.rewardEnergy,
        stats,
      };
    });
  }

  async recordProgress(
    tx: Prisma.TransactionClient,
    userId: string,
    progress: Partial<Record<QuestMetric, number>>,
    now: Date,
  ) {
    const quests = await tx.quest.findMany({
      where: {
        isActive: true,
        metric: { in: Object.keys(progress) as QuestMetric[] },
      },
      select: {
        id: true,
        period: true,
        metric: true,
      },
    });

    for (const quest of quests) {
      const amount = progress[quest.metric];

      if (!amount) {
        continue;
      }

      const { start: periodStart } = getQuestPeriod(quest.period, now);

      await tx.userQuest.upsert({
        where: {
          userId_questId_periodStart: {
            userId,
            questId: quest.id,
            periodStart,
          },
        },
        create: {
          userId,
          questId: quest.id,
          periodStart,
          progress: amount,
        },
        update: {
          progress: { increment: amount },
        },
      });
    }
  }
}
