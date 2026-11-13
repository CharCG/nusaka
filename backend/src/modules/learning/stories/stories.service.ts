import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { STORY_COMPLETION_XP, STORY_UNLOCK_COST_GEMS } from './stories.constants.js';
import { FindStoriesQueryDto } from './dto/find-stories-query.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Paginated } from '../../../common/dto/paginated-response.dto.js';
import { Prisma } from '../../../generated/prisma/client.js';

@Injectable()
export class StoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(userId: string, dto: FindStoriesQueryDto) {
    const [stories, total] = await Promise.all([
      this.prismaService.story.findMany({
        where: dto.languageCode ? { language: { code: dto.languageCode } } : {},
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
      this.prismaService.story.count({ where: dto.languageCode ? { language: { code: dto.languageCode } } : {} }),
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

  async unlockStory(userId: string, storyId: string) {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const story = await tx.story.findUnique({
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
            throw new BadRequestException('Story does not contain any pages');
          }

          if (stats.gems < STORY_UNLOCK_COST_GEMS) {
            throw new BadRequestException('Not enough gems to unlock the story');
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
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
        throw new ConflictException('Unable to unlock the story. Please try again');
      }

      throw error;
    }
  }

  async completeStory(userId: string, storyId: string) {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const story = await tx.story.findUnique({
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

          const progress = await tx.storyProgress.findUnique({
            where: {
              userId_storyId: {
                userId,
                storyId,
              },
            },
            select: { completedAt: true },
          });

          if (!progress) {
            throw new ForbiddenException('Story is locked');
          }

          if (story._count.pages === 0) {
            throw new BadRequestException('Story does not contain any pages');
          }

          const now = new Date();
          const firstCompletion = progress.completedAt === null;

          if (firstCompletion) {
            await tx.storyProgress.update({
              where: {
                userId_storyId: {
                  userId,
                  storyId,
                },
              },
              data: { completedAt: now },
            });

            await tx.userStats.update({
              where: { userId },
              data: {
                xp: { increment: STORY_COMPLETION_XP },
              },
            });
          }

          const stats = await tx.userStats.findUnique({
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
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Unable to complete the story. Please try again');
      }

      throw error;
    }
  }
}
