import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { STORY_COMPLETION_XP, STORY_UNLOCK_COST_GEMS } from './stories.constants.js';
import { FindStoriesQueryDto } from './dto/find-stories-query.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StreaksService } from '../../streaks/streaks.service.js';
import { QuestsService } from '../../quests/quests.service.js';
import { Paginated } from '../../../common/dto/paginated-response.dto.js';
import { utcDay } from '../../../common/utils/day.util.js';
import { Prisma } from '../../../generated/prisma/client.js';

@Injectable()
export class StoriesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly streaksService: StreaksService,
    private readonly questsService: QuestsService,
  ) {}

  async findAll(userId: string, dto: FindStoriesQueryDto) {
    const where: Prisma.StoryWhereInput = dto.languageCode ? { language: { code: dto.languageCode } } : {};

    const [stories, total] = await Promise.all([
      this.prismaService.story.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          language: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: { pages: true },
          },
          progresses: {
            where: { userId },
            select: {
              unlockedAt: true,
              completedAt: true,
            },
          },
        },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prismaService.story.count({ where }),
    ]);

    const items = stories.map((story) => {
      const progress = story.progresses[0];

      return {
        id: story.id,
        title: story.title,
        description: story.description,
        language: story.language,
        pageCount: story._count.pages,
        unlockPrice: STORY_UNLOCK_COST_GEMS,
        isUnlocked: progress !== undefined,
        isCompleted: progress?.completedAt != null,
        unlockedAt: progress?.unlockedAt ?? null,
        completedAt: progress?.completedAt ?? null,
      };
    });

    return new Paginated(items, total, dto.page, dto.limit);
  }

  async findStoryPages(userId: string, storyId: string) {
    const story = await this.prismaService.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        title: true,
        progresses: {
          where: { userId },
          select: { unlockedAt: true },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.progresses.length === 0) {
      throw new ForbiddenException('Story locked');
    }

    const pages = await this.prismaService.storyPage.findMany({
      where: { storyId },
      select: {
        id: true,
        order: true,
        content: true,
      },
      orderBy: { order: 'asc' },
    });

    return {
      id: story.id,
      title: story.title,
      pages,
    };
  }

  async unlockStory(userId: string, storyId: string) {
    const story = await this.prismaService.story.findUnique({
      where: { id: storyId },
      select: {
        _count: {
          select: { pages: true },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    try {
      return await this.prismaService.runSerializableTransaction(async (tx) => {
        const progress = await tx.storyProgress.findUnique({
          where: {
            userId_storyId: {
              userId,
              storyId,
            },
          },
          select: { userId: true },
        });

        const stats = await tx.userStats.findUnique({
          where: { userId },
          select: { gems: true },
        });

        if (!stats) {
          throw new NotFoundException('User stats not found');
        }

        if (progress) {
          return {
            storyId,
            isUnlocked: true,
            gems: stats.gems,
          };
        }

        if (story._count.pages === 0) {
          throw new BadRequestException('Story has no pages');
        }

        if (stats.gems < STORY_UNLOCK_COST_GEMS) {
          throw new BadRequestException('Insufficient gems');
        }

        const updatedStats = await tx.userStats.update({
          where: { userId },
          data: {
            gems: { decrement: STORY_UNLOCK_COST_GEMS },
          },
          select: { gems: true },
        });

        await tx.storyProgress.create({
          data: {
            userId,
            storyId,
          },
        });

        return {
          storyId,
          isUnlocked: true,
          gems: updatedStats.gems,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const stats = await this.prismaService.userStats.findUnique({
          where: { userId },
          select: { gems: true },
        });

        if (!stats) {
          throw new NotFoundException('User stats not found');
        }

        return {
          storyId,
          isUnlocked: true,
          gems: stats.gems,
        };
      }

      throw error;
    }
  }

  async completeStory(userId: string, storyId: string) {
    const story = await this.prismaService.story.findUnique({
      where: { id: storyId },
      select: {
        _count: {
          select: { pages: true },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return this.prismaService.runSerializableTransaction(async (tx) => {
      const progress = await tx.storyProgress.findUnique({
        where: {
          userId_storyId: {
            userId,
            storyId,
          },
        },
        select: {
          completedAt: true,
          lastCompletedAt: true,
        },
      });

      if (!progress) {
        throw new ForbiddenException('Story locked');
      }

      if (story._count.pages === 0) {
        throw new BadRequestException('Story has no pages');
      }

      const now = new Date();
      const today = utcDay(now);
      const firstCompletion = progress.completedAt === null;
      const lastCompletedAt = progress.lastCompletedAt ?? progress.completedAt;
      const shouldRecordQuestCompletion =
        lastCompletedAt === null || utcDay(lastCompletedAt).getTime() < today.getTime();

      if (firstCompletion) {
        await tx.storyProgress.update({
          where: {
            userId_storyId: {
              userId,
              storyId,
            },
          },
          data: {
            completedAt: now,
            lastCompletedAt: now,
          },
        });
      } else if (shouldRecordQuestCompletion) {
        await tx.storyProgress.update({
          where: {
            userId_storyId: {
              userId,
              storyId,
            },
          },
          data: {
            lastCompletedAt: now,
          },
        });
      }

      await this.streaksService.recordStreakActivity(tx, userId, now);

      if (shouldRecordQuestCompletion) {
        await this.questsService.recordProgress(
          tx,
          userId,
          {
            STORIES_COMPLETED: 1,
            XP_EARNED: firstCompletion ? STORY_COMPLETION_XP : undefined,
          },
          now,
        );
      }

      const stats = firstCompletion
        ? await tx.userStats.update({
            where: { userId },
            data: {
              xp: { increment: STORY_COMPLETION_XP },
            },
            select: { xp: true },
          })
        : await tx.userStats.findUnique({
            where: { userId },
            select: { xp: true },
          });

      if (!stats) {
        throw new NotFoundException('User stats not found');
      }

      return {
        storyId,
        isCompleted: true,
        firstCompletion,
        completedAt: progress.completedAt ?? now,
        xpReward: firstCompletion ? STORY_COMPLETION_XP : 0,
        stats,
      };
    });
  }
}
