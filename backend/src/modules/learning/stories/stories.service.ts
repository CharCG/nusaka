import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { STORY_COMPLETION_XP, STORY_UNLOCK_COST_GEMS } from './stories.constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StreaksService } from '../../streaks/streaks.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { Paginated } from '../../../common/dto/paginated-response.dto.js';
import { FindStoriesQueryDto } from './dto/find-stories-query.dto.js';

@Injectable()
export class StoriesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly streaksService: StreaksService,
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
            select: { id: true, code: true, name: true },
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

  async findPages(userId: string, storyId: string) {
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
      throw new ForbiddenException('Story is locked');
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

  async unlock(userId: string, storyId: string) {
    return this.prismaService.withTransactionRetry(async (tx) => {
      const story = await tx.story.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          _count: {
            select: { pages: true },
          },
        },
      });

      if (!story) {
        throw new NotFoundException('Story not found');
      }

      const progress = await tx.storyProgress.findUnique({
        where: {
          userId_storyId: {
            userId,
            storyId,
          },
        },
      });

      let stats = await tx.userStats.findUnique({
        where: { userId },
        select: { gems: true },
      });

      if (!stats) {
        throw new NotFoundException('User stats not found');
      }

      if (!progress) {
        if (story._count.pages === 0) {
          throw new BadRequestException('Story does not contain any pages');
        }

        if (stats.gems < STORY_UNLOCK_COST_GEMS) {
          throw new BadRequestException('Not enough gems to unlock the story');
        }

        stats = await tx.userStats.update({
          where: { userId },
          data: {
            gems: {
              decrement: STORY_UNLOCK_COST_GEMS,
            },
          },
          select: { gems: true },
        });

        await tx.storyProgress.create({
          data: {
            userId,
            storyId,
          },
        });
      }

      return {
        storyId,
        isUnlocked: true,
        gems: stats.gems,
      };
    });
  }

  async complete(userId: string, storyId: string) {
    return this.prismaService.withTransactionRetry(async (tx) => {
      const now = new Date();

      const story = await tx.story.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          _count: {
            select: { pages: true },
          },
        },
      });

      if (!story) {
        throw new NotFoundException('Story not found');
      }

      const progress = await tx.storyProgress.findUnique({
        where: {
          userId_storyId: {
            userId,
            storyId,
          },
        },
      });

      if (!progress) {
        throw new ForbiddenException('Story is locked');
      }

      if (story._count.pages === 0) {
        throw new BadRequestException('Story does not contain any pages');
      }

      const firstCompletion = progress.completedAt === null;

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
          },
        });

        await tx.userStats.update({
          where: { userId },
          data: {
            xp: {
              increment: STORY_COMPLETION_XP,
            },
          },
        });
      }

      await this.streaksService.recordActivity(tx, userId, now);

      const stats = await tx.userStats.findUniqueOrThrow({
        where: { userId },
        select: {
          xp: true,
          gems: true,
          currentStreak: true,
          longestStreak: true,
        },
      });

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
