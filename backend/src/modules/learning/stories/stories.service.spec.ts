import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoriesService } from './stories.service.js';
import { STORY_COMPLETION_XP, STORY_UNLOCK_COST_GEMS } from './stories.constants.js';
import { FindStoriesQueryDto } from './dto/find-stories-query.dto.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { StreaksService } from '../../streaks/streaks.service.js';
import type { QuestsService } from '../../quests/quests.service.js';

function createMocks() {
  const tx = {
    storyProgress: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const prismaService = {
    story: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    storyPage: {
      findMany: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
    },
    runSerializableTransaction: vi
      .fn()
      .mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  const streaksService = {
    recordStreakActivity: vi.fn().mockResolvedValue(undefined),
  };

  const questsService = {
    recordProgress: vi.fn().mockResolvedValue(undefined),
  };

  const service = new StoriesService(
    prismaService as unknown as PrismaService,
    streaksService as unknown as StreaksService,
    questsService as unknown as QuestsService,
  );

  return { service, prismaService, tx, streaksService, questsService };
}

describe('StoriesService', () => {
  describe('findAll', () => {
    it('returns paginated stories mapped with unlock and completion flags', async () => {
      const { service, prismaService } = createMocks();
      const unlockedAt = new Date('2026-11-28T00:00:00.000Z');
      const query = Object.assign(new FindStoriesQueryDto(), { page: 1, limit: 10, languageCode: 'jav' });

      prismaService.story.findMany.mockResolvedValue([
        {
          id: 'story-1',
          title: 'Nara and the Quiet Garden',
          description: 'A village garden story',
          language: { id: 'lang-1', code: 'jav', name: 'Java' },
          _count: { pages: 4 },
          progresses: [{ unlockedAt, completedAt: null }],
        },
      ]);
      prismaService.story.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', query);

      expect(prismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { language: { code: 'jav' } },
          skip: 0,
          take: 10,
        }),
      );
      expect(prismaService.story.count).toHaveBeenCalledWith({
        where: { language: { code: 'jav' } },
      });
      expect(result.items).toEqual([
        {
          id: 'story-1',
          title: 'Nara and the Quiet Garden',
          description: 'A village garden story',
          language: { id: 'lang-1', code: 'jav', name: 'Java' },
          pageCount: 4,
          unlockPrice: STORY_UNLOCK_COST_GEMS,
          isUnlocked: true,
          isCompleted: false,
          unlockedAt,
          completedAt: null,
        },
      ]);
    });
  });

  describe('findStoryPages', () => {
    it('throws NotFoundException when story does not exist', async () => {
      const { service, prismaService } = createMocks();
      prismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.findStoryPages('user-1', 'story-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when story is locked', async () => {
      const { service, prismaService } = createMocks();
      prismaService.story.findUnique.mockResolvedValue({
        id: 'story-1',
        title: 'Nara',
        progresses: [],
      });

      await expect(service.findStoryPages('user-1', 'story-1')).rejects.toThrow(ForbiddenException);
      expect(prismaService.storyPage.findMany).not.toHaveBeenCalled();
    });

    it('returns story pages when unlocked', async () => {
      const { service, prismaService } = createMocks();
      const pages = [{ id: 'p-1', order: 1, content: 'Hello' }];

      prismaService.story.findUnique.mockResolvedValue({
        id: 'story-1',
        title: 'Nara',
        progresses: [{ unlockedAt: new Date() }],
      });
      prismaService.storyPage.findMany.mockResolvedValue(pages);

      await expect(service.findStoryPages('user-1', 'story-1')).resolves.toEqual({
        id: 'story-1',
        title: 'Nara',
        pages,
      });
    });
  });

  describe('unlockStory', () => {
    it('deducts gems and creates story progress when locked', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue(null);
      tx.userStats.findUnique.mockResolvedValue({ gems: 30 });
      tx.userStats.update.mockResolvedValue({ gems: 5 });
      tx.storyProgress.create.mockResolvedValue({ userId: 'user-1', storyId: 'story-1' });

      const result = await service.unlockStory('user-1', 'story-1');

      expect(tx.userStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { gems: { decrement: STORY_UNLOCK_COST_GEMS } },
        select: { gems: true },
      });
      expect(result).toEqual({
        storyId: 'story-1',
        isUnlocked: true,
        gems: 5,
      });
    });

    it('returns idempotently if story is already unlocked', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue({ userId: 'user-1' });
      tx.userStats.findUnique.mockResolvedValue({ gems: 10 });

      const result = await service.unlockStory('user-1', 'story-1');

      expect(tx.userStats.update).not.toHaveBeenCalled();
      expect(tx.storyProgress.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        storyId: 'story-1',
        isUnlocked: true,
        gems: 10,
      });
    });

    it('recovers idempotently on concurrent P2002 unique constraint race', async () => {
      const { service, prismaService } = createMocks();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      prismaService.runSerializableTransaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );
      prismaService.userStats.findUnique.mockResolvedValue({ gems: 5 });

      const result = await service.unlockStory('user-1', 'story-1');

      expect(result).toEqual({
        storyId: 'story-1',
        isUnlocked: true,
        gems: 5,
      });
    });

    it('throws BadRequestException when user has insufficient gems', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue(null);
      tx.userStats.findUnique.mockResolvedValue({ gems: 10 });

      await expect(service.unlockStory('user-1', 'story-1')).rejects.toThrow(BadRequestException);
      expect(tx.userStats.update).not.toHaveBeenCalled();
    });
  });

  describe('completeStory', () => {
    it('awards XP, sets completedAt & lastCompletedAt, and records streak and quests on first completion', async () => {
      const { service, prismaService, tx, streaksService, questsService } = createMocks();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue({ completedAt: null, lastCompletedAt: null });
      tx.userStats.update.mockResolvedValue({ xp: 10 });

      const result = await service.completeStory('user-1', 'story-1');

      expect(tx.storyProgress.update).toHaveBeenCalledWith({
        where: { userId_storyId: { userId: 'user-1', storyId: 'story-1' } },
        data: { completedAt: expect.any(Date), lastCompletedAt: expect.any(Date) },
      });
      expect(tx.userStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { xp: { increment: STORY_COMPLETION_XP } },
        select: { xp: true },
      });
      expect(tx.userStats.findUnique).not.toHaveBeenCalled();
      expect(streaksService.recordStreakActivity).toHaveBeenCalledTimes(1);
      expect(questsService.recordProgress).toHaveBeenCalledWith(
        tx,
        'user-1',
        {
          STORIES_COMPLETED: 1,
          XP_EARNED: STORY_COMPLETION_XP,
        },
        expect.any(Date),
      );
      expect(result).toEqual({
        storyId: 'story-1',
        isCompleted: true,
        firstCompletion: true,
        completedAt: expect.any(Date),
        xpReward: STORY_COMPLETION_XP,
        stats: { xp: 10 },
      });
    });

    it('skips quest progress and storyProgress update on same-day replay or double-tap', async () => {
      const { service, prismaService, tx, streaksService, questsService } = createMocks();
      const earlierToday = new Date();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue({
        completedAt: earlierToday,
        lastCompletedAt: earlierToday,
      });
      tx.userStats.findUnique.mockResolvedValue({ xp: 10 });

      const result = await service.completeStory('user-1', 'story-1');

      expect(tx.storyProgress.update).not.toHaveBeenCalled();
      expect(tx.userStats.update).not.toHaveBeenCalled();
      expect(questsService.recordProgress).not.toHaveBeenCalled();
      expect(streaksService.recordStreakActivity).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        storyId: 'story-1',
        isCompleted: true,
        firstCompletion: false,
        completedAt: earlierToday,
        xpReward: 0,
        stats: { xp: 10 },
      });
    });

    it('credits STORIES_COMPLETED quest on a new UTC day replay without awarding XP again', async () => {
      const { service, prismaService, tx, streaksService, questsService } = createMocks();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue({
        completedAt: yesterday,
        lastCompletedAt: yesterday,
      });
      tx.userStats.findUnique.mockResolvedValue({ xp: 10 });

      const result = await service.completeStory('user-1', 'story-1');

      expect(tx.storyProgress.update).toHaveBeenCalledWith({
        where: { userId_storyId: { userId: 'user-1', storyId: 'story-1' } },
        data: { lastCompletedAt: expect.any(Date) },
      });
      expect(tx.userStats.update).not.toHaveBeenCalled();
      expect(streaksService.recordStreakActivity).toHaveBeenCalledTimes(1);
      expect(questsService.recordProgress).toHaveBeenCalledWith(
        tx,
        'user-1',
        {
          STORIES_COMPLETED: 1,
          XP_EARNED: undefined,
        },
        expect.any(Date),
      );
      expect(result.firstCompletion).toBe(false);
      expect(result.xpReward).toBe(0);
    });

    it('falls back to completedAt for pre-migration rows where lastCompletedAt is null', async () => {
      const { service, prismaService, tx, questsService } = createMocks();
      const earlierToday = new Date();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue({
        completedAt: earlierToday,
        lastCompletedAt: null,
      });
      tx.userStats.findUnique.mockResolvedValue({ xp: 10 });

      await service.completeStory('user-1', 'story-1');

      expect(tx.storyProgress.update).not.toHaveBeenCalled();
      expect(questsService.recordProgress).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when story is locked', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.story.findUnique.mockResolvedValue({ _count: { pages: 4 } });
      tx.storyProgress.findUnique.mockResolvedValue(null);

      await expect(service.completeStory('user-1', 'story-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
