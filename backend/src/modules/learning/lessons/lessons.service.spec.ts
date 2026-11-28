import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { LessonAttemptStatus, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { StreaksService } from '../../streaks/streaks.service.js';
import type { QuestsService } from '../../quests/quests.service.js';

function createLessonRecord(overrides: Partial<{ id: string; order: number; exercises: unknown[] }> = {}) {
  return {
    id: overrides.id ?? 'lesson-1',
    title: 'Basic Greetings',
    order: overrides.order ?? 1,
    exercises: overrides.exercises ?? [
      {
        id: 'ex-1',
        type: 'MULTIPLE_CHOICE',
        order: 1,
        question: { prompt: 'What does "sugeng enjing" mean?' },
        answer: { correctOptionId: 'a' },
      },
    ],
    chapter: {
      id: 'chapter-1',
      order: 1,
      unit: {
        id: 'unit-1',
        order: 1,
        languageId: 'lang-jav',
      },
    },
  };
}

function createMocks() {
  const tx = {
    lessonAttempt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    lessonProgress: {
      findUnique: vi.fn(),
      createMany: vi.fn(),
    },
  };

  const prismaService = {
    lesson: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    lessonAttempt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    userStats: {
      findUnique: vi.fn(),
    },
    lessonProgress: {
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

  const service = new LessonsService(
    prismaService as unknown as PrismaService,
    streaksService as unknown as StreaksService,
    questsService as unknown as QuestsService,
  );

  return { service, prismaService, tx, streaksService, questsService };
}

describe('LessonsService', () => {
  describe('startLessonAttempt', () => {
    it('deducts 1 energy, closes open attempts, and returns lesson exercises with answers', async () => {
      const { service, prismaService, tx } = createMocks();
      const lesson = createLessonRecord();

      prismaService.lesson.findUnique.mockResolvedValue(lesson);
      prismaService.lesson.findFirst.mockResolvedValue(null);
      tx.lessonAttempt.findUnique.mockResolvedValue(null);
      tx.userStats.findUnique.mockResolvedValue({ energy: 5 });
      tx.lessonProgress.findUnique.mockResolvedValue(null);
      tx.userStats.update.mockResolvedValue({ energy: 4 });
      tx.lessonAttempt.updateMany.mockResolvedValue({ count: 0 });
      tx.lessonAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-1',
        status: LessonAttemptStatus.IN_PROGRESS,
        mistakes: 0,
        startedAt: new Date(),
        finishedAt: null,
      });

      const result = await service.startLessonAttempt('user-1', 'lesson-1', { requestId: 'req-1' });

      expect(result).toEqual({
        attemptId: 'attempt-1',
        status: LessonAttemptStatus.IN_PROGRESS,
        energy: 4,
        isReplay: false,
        lesson: {
          id: 'lesson-1',
          title: 'Basic Greetings',
          order: 1,
          exercises: lesson.exercises,
        },
      });
      expect(tx.userStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { energy: { decrement: 1 } },
        select: { energy: true },
      });
    });

    it('throws ForbiddenException when previous lesson is not completed', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.lesson.findUnique.mockResolvedValue(createLessonRecord({ id: 'lesson-2', order: 2 }));
      prismaService.lesson.findFirst.mockResolvedValue({ id: 'lesson-1' });
      tx.lessonAttempt.findUnique.mockResolvedValue(null);
      tx.userStats.findUnique.mockResolvedValue({ energy: 5 });
      tx.lessonProgress.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(service.startLessonAttempt('user-1', 'lesson-2', { requestId: 'req-2' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(tx.userStats.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when user has insufficient energy', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.lesson.findUnique.mockResolvedValue(createLessonRecord());
      prismaService.lesson.findFirst.mockResolvedValue(null);
      tx.lessonAttempt.findUnique.mockResolvedValue(null);
      tx.userStats.findUnique.mockResolvedValue({ energy: 0 });

      await expect(service.startLessonAttempt('user-1', 'lesson-1', { requestId: 'req-3' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('recovers idempotently when concurrent request hits P2002 on requestId', async () => {
      const { service, prismaService } = createMocks();
      const lesson = createLessonRecord();

      prismaService.lesson.findUnique.mockResolvedValue(lesson);
      prismaService.lesson.findFirst.mockResolvedValue(null);
      prismaService.runSerializableTransaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );
      prismaService.lessonAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-1',
        status: LessonAttemptStatus.IN_PROGRESS,
        mistakes: 0,
        startedAt: new Date(),
        finishedAt: null,
      });
      prismaService.lessonProgress.findUnique.mockResolvedValue(null);
      prismaService.userStats.findUnique.mockResolvedValue({ energy: 4 });

      const result = await service.startLessonAttempt('user-1', 'lesson-1', { requestId: 'req-1' });

      expect(result.attemptId).toBe('attempt-1');
      expect(result.energy).toBe(4);
    });

    it('throws ConflictException when reusing requestId for a different lesson', async () => {
      const { service, prismaService, tx } = createMocks();

      prismaService.lesson.findUnique.mockResolvedValue(createLessonRecord({ id: 'lesson-2', order: 2 }));
      prismaService.lesson.findFirst.mockResolvedValue({ id: 'lesson-1' });
      tx.lessonAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-1',
        status: LessonAttemptStatus.IN_PROGRESS,
        mistakes: 0,
        startedAt: new Date(),
        finishedAt: null,
      });

      await expect(service.startLessonAttempt('user-1', 'lesson-2', { requestId: 'req-1' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('finishLessonAttempt', () => {
    it('awards XP (with perfect bonus) and gems, but NO energy, on first perfect completion', async () => {
      const { service, tx, streaksService, questsService } = createMocks();
      const now = new Date();

      tx.lessonAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-1',
        status: LessonAttemptStatus.IN_PROGRESS,
        mistakes: 0,
        startedAt: now,
        finishedAt: null,
      });
      tx.lessonProgress.createMany.mockResolvedValue({ count: 1 });
      tx.userStats.update.mockResolvedValue({ xp: 15, energy: 4, gems: 30 });
      tx.lessonAttempt.update.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-1',
        status: LessonAttemptStatus.COMPLETED,
        mistakes: 0,
        startedAt: now,
        finishedAt: now,
      });

      const result = await service.finishLessonAttempt('user-1', 'attempt-1', { completed: true, mistakes: 0 });

      expect(tx.userStats.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          xp: { increment: 15 },
          gems: { increment: 5 },
        },
        select: {
          xp: true,
          energy: true,
          gems: true,
        },
      });
      expect(streaksService.recordStreakActivity).toHaveBeenCalledTimes(1);
      expect(questsService.recordProgress).toHaveBeenCalledWith(
        tx,
        'user-1',
        {
          LESSONS_COMPLETED: 1,
          PERFECT_LESSONS_COMPLETED: 1,
          XP_EARNED: 15,
        },
        expect.any(Date),
      );
      expect(result).toEqual({
        attemptId: 'attempt-1',
        lessonId: 'lesson-1',
        status: LessonAttemptStatus.COMPLETED,
        mistakes: 0,
        isPerfect: true,
        firstCompletion: true,
        rewards: { xp: 15, gems: 5 },
        finishedAt: now,
        stats: { xp: 15, energy: 4, gems: 30 },
      });
    });

    it('awards 0 rewards on replay while still recording streak and quests', async () => {
      const { service, tx, streaksService, questsService } = createMocks();
      const now = new Date();

      tx.lessonAttempt.findFirst.mockResolvedValue({
        id: 'attempt-2',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-2',
        status: LessonAttemptStatus.IN_PROGRESS,
        mistakes: 0,
        startedAt: now,
        finishedAt: null,
      });
      tx.lessonProgress.createMany.mockResolvedValue({ count: 0 });
      tx.userStats.findUnique.mockResolvedValue({ xp: 15, energy: 3, gems: 30 });
      tx.lessonAttempt.update.mockResolvedValue({
        id: 'attempt-2',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-2',
        status: LessonAttemptStatus.COMPLETED,
        mistakes: 2,
        startedAt: now,
        finishedAt: now,
      });

      const result = await service.finishLessonAttempt('user-1', 'attempt-2', { completed: true, mistakes: 2 });

      expect(tx.userStats.update).not.toHaveBeenCalled();
      expect(streaksService.recordStreakActivity).toHaveBeenCalledTimes(1);
      expect(questsService.recordProgress).toHaveBeenCalledWith(
        tx,
        'user-1',
        {
          LESSONS_COMPLETED: 1,
          PERFECT_LESSONS_COMPLETED: undefined,
          XP_EARNED: undefined,
        },
        expect.any(Date),
      );
      expect(result.firstCompletion).toBe(false);
      expect(result.rewards).toEqual({ xp: 0, gems: 0 });
      expect(result.isPerfect).toBe(false);
    });

    it('marks attempt FAILED without rewards, streak, or quests when completed is false', async () => {
      const { service, tx, streaksService, questsService } = createMocks();
      const now = new Date();

      tx.lessonAttempt.findFirst.mockResolvedValue({
        id: 'attempt-3',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-3',
        status: LessonAttemptStatus.IN_PROGRESS,
        mistakes: 0,
        startedAt: now,
        finishedAt: null,
      });
      tx.userStats.findUnique.mockResolvedValue({ xp: 0, energy: 4, gems: 25 });
      tx.lessonAttempt.update.mockResolvedValue({
        id: 'attempt-3',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-3',
        status: LessonAttemptStatus.FAILED,
        mistakes: 0,
        startedAt: now,
        finishedAt: now,
      });

      const result = await service.finishLessonAttempt('user-1', 'attempt-3', { completed: false, mistakes: 0 });

      expect(tx.lessonProgress.createMany).not.toHaveBeenCalled();
      expect(tx.userStats.update).not.toHaveBeenCalled();
      expect(streaksService.recordStreakActivity).not.toHaveBeenCalled();
      expect(questsService.recordProgress).not.toHaveBeenCalled();
      expect(result.status).toBe(LessonAttemptStatus.FAILED);
      expect(result.isPerfect).toBe(false);
      expect(result.rewards).toEqual({ xp: 0, gems: 0 });
    });

    it('returns existing result idempotently if attempt is already finished', async () => {
      const { service, tx } = createMocks();
      const finishedAt = new Date();

      tx.lessonAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        requestId: 'req-1',
        status: LessonAttemptStatus.COMPLETED,
        mistakes: 0,
        startedAt: finishedAt,
        finishedAt,
      });
      tx.userStats.findUnique.mockResolvedValue({ xp: 15, energy: 4, gems: 30 });

      const result = await service.finishLessonAttempt('user-1', 'attempt-1', { completed: true, mistakes: 0 });

      expect(tx.lessonAttempt.update).not.toHaveBeenCalled();
      expect(tx.userStats.update).not.toHaveBeenCalled();
      expect(result.firstCompletion).toBe(false);
      expect(result.rewards).toEqual({ xp: 0, gems: 0 });
      expect(result.isPerfect).toBe(true);
    });
  });
});
