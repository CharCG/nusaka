import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LESSON_COMPLETION_GEMS,
  LESSON_COMPLETION_XP,
  LESSON_PERFECT_COMPLETION_BONUS_XP,
} from './lessons.constants.js';
import { StartLessonDto } from './dto/start-lesson.dto.js';
import { FinishLessonAttemptDto } from './dto/finish-lesson-attempt.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StreaksService } from '../../streaks/streaks.service.js';
import { QuestsService } from '../../quests/quests.service.js';
import { LessonAttemptStatus, Prisma, type LessonAttempt } from '../../../generated/prisma/client.js';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly streaksService: StreaksService,
    private readonly questsService: QuestsService,
  ) {}

  async startLessonAttempt(userId: string, lessonId: string, dto: StartLessonDto) {
    const lesson = await this.prismaService.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        order: true,
        exercises: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            type: true,
            order: true,
            question: true,
            answer: true,
          },
        },
        chapter: {
          select: {
            id: true,
            order: true,
            unit: {
              select: {
                id: true,
                order: true,
                languageId: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.exercises.length === 0) {
      throw new BadRequestException('Lesson has no exercises');
    }

    const previousLesson = await this.prismaService.lesson.findFirst({
      where: {
        chapter: {
          unit: {
            languageId: lesson.chapter.unit.languageId,
          },
        },
        OR: [
          {
            chapterId: lesson.chapter.id,
            order: { lt: lesson.order },
          },
          {
            chapter: {
              unitId: lesson.chapter.unit.id,
              order: { lt: lesson.chapter.order },
            },
          },
          {
            chapter: {
              unit: {
                languageId: lesson.chapter.unit.languageId,
                order: { lt: lesson.chapter.unit.order },
              },
            },
          },
        ],
      },
      orderBy: [{ chapter: { unit: { order: 'desc' } } }, { chapter: { order: 'desc' } }, { order: 'desc' }],
      select: { id: true },
    });

    const lessonResponse = {
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      exercises: lesson.exercises,
    };

    try {
      return await this.prismaService.runSerializableTransaction(async (tx) => {
        const existingAttempt = await tx.lessonAttempt.findUnique({
          where: {
            userId_requestId: {
              userId,
              requestId: dto.requestId,
            },
          },
        });

        if (existingAttempt) {
          return this.existingAttemptResponse(tx, existingAttempt, lessonResponse);
        }

        const stats = await tx.userStats.findUnique({
          where: { userId },
          select: { energy: true },
        });

        if (!stats) {
          throw new NotFoundException('User stats not found');
        }

        if (stats.energy < 1) {
          throw new BadRequestException('Insufficient energy');
        }

        const progress = await tx.lessonProgress.findUnique({
          where: {
            userId_lessonId: {
              userId,
              lessonId,
            },
          },
          select: { completedAt: true },
        });

        if (!progress && previousLesson) {
          const previousProgress = await tx.lessonProgress.findUnique({
            where: {
              userId_lessonId: {
                userId,
                lessonId: previousLesson.id,
              },
            },
            select: { completedAt: true },
          });

          if (!previousProgress) {
            throw new ForbiddenException('Lesson locked');
          }
        }

        const updatedStats = await tx.userStats.update({
          where: { userId },
          data: { energy: { decrement: 1 } },
          select: { energy: true },
        });

        await tx.lessonAttempt.updateMany({
          where: {
            userId,
            status: LessonAttemptStatus.IN_PROGRESS,
          },
          data: {
            status: LessonAttemptStatus.FAILED,
            finishedAt: new Date(),
          },
        });

        const attempt = await tx.lessonAttempt.create({
          data: {
            userId,
            lessonId,
            requestId: dto.requestId,
          },
        });

        return {
          attemptId: attempt.id,
          status: attempt.status,
          energy: updatedStats.energy,
          isReplay: progress !== null,
          lesson: lessonResponse,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingAttempt = await this.prismaService.lessonAttempt.findUnique({
          where: {
            userId_requestId: {
              userId,
              requestId: dto.requestId,
            },
          },
        });

        if (existingAttempt) {
          return this.existingAttemptResponse(this.prismaService, existingAttempt, lessonResponse);
        }
      }

      throw error;
    }
  }

  async finishLessonAttempt(userId: string, attemptId: string, dto: FinishLessonAttemptDto) {
    return this.prismaService.runSerializableTransaction(async (tx) => {
      const attempt = await tx.lessonAttempt.findFirst({
        where: {
          id: attemptId,
          userId,
        },
      });

      if (!attempt) {
        throw new NotFoundException('Lesson attempt not found');
      }

      if (attempt.status !== LessonAttemptStatus.IN_PROGRESS) {
        const stats = await tx.userStats.findUnique({
          where: { userId },
          select: {
            xp: true,
            energy: true,
            gems: true,
          },
        });

        if (!stats) {
          throw new NotFoundException('User stats not found');
        }

        return {
          attemptId: attempt.id,
          lessonId: attempt.lessonId,
          status: attempt.status,
          mistakes: attempt.mistakes,
          isPerfect: attempt.status === LessonAttemptStatus.COMPLETED && attempt.mistakes === 0,
          firstCompletion: false,
          rewards: {
            xp: 0,
            gems: 0,
          },
          finishedAt: attempt.finishedAt,
          stats,
        };
      }

      const status = dto.completed ? LessonAttemptStatus.COMPLETED : LessonAttemptStatus.FAILED;
      const now = new Date();
      let firstCompletion = false;

      if (status === LessonAttemptStatus.COMPLETED) {
        const progress = await tx.lessonProgress.createMany({
          data: [
            {
              userId,
              lessonId: attempt.lessonId,
            },
          ],
          skipDuplicates: true,
        });

        firstCompletion = progress.count === 1;

        await this.streaksService.recordStreakActivity(tx, userId, now);
      }

      const xpReward = firstCompletion
        ? LESSON_COMPLETION_XP + (dto.mistakes === 0 ? LESSON_PERFECT_COMPLETION_BONUS_XP : 0)
        : 0;
      const gemsReward = firstCompletion ? LESSON_COMPLETION_GEMS : 0;

      if (status === LessonAttemptStatus.COMPLETED) {
        await this.questsService.recordProgress(
          tx,
          userId,
          {
            LESSONS_COMPLETED: 1,
            PERFECT_LESSONS_COMPLETED: dto.mistakes === 0 ? 1 : undefined,
            XP_EARNED: xpReward > 0 ? xpReward : undefined,
          },
          now,
        );
      }

      const stats = firstCompletion
        ? await tx.userStats.update({
            where: { userId },
            data: {
              xp: { increment: xpReward },
              gems: { increment: gemsReward },
            },
            select: {
              xp: true,
              energy: true,
              gems: true,
            },
          })
        : await tx.userStats.findUnique({
            where: { userId },
            select: {
              xp: true,
              energy: true,
              gems: true,
            },
          });

      if (!stats) {
        throw new NotFoundException('User stats not found');
      }

      const finishedAttempt = await tx.lessonAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          mistakes: dto.mistakes,
          finishedAt: now,
        },
      });

      return {
        attemptId: finishedAttempt.id,
        lessonId: finishedAttempt.lessonId,
        status: finishedAttempt.status,
        mistakes: finishedAttempt.mistakes,
        isPerfect: finishedAttempt.status === LessonAttemptStatus.COMPLETED && finishedAttempt.mistakes === 0,
        firstCompletion,
        rewards: {
          xp: xpReward,
          gems: gemsReward,
        },
        finishedAt: finishedAttempt.finishedAt,
        stats,
      };
    });
  }

  private async existingAttemptResponse(
    tx: Prisma.TransactionClient,
    lessonAttempt: LessonAttempt,
    lesson: {
      id: string;
      title: string;
      order: number;
      exercises: {
        id: string;
        type: string;
        order: number;
        question: Prisma.JsonValue;
        answer: Prisma.JsonValue;
      }[];
    },
  ) {
    if (lessonAttempt.lessonId !== lesson.id) {
      throw new ConflictException('Request ID already used');
    }

    if (lessonAttempt.status !== LessonAttemptStatus.IN_PROGRESS) {
      throw new ConflictException('Lesson attempt already ended');
    }

    const [progress, stats] = await Promise.all([
      tx.lessonProgress.findUnique({
        where: {
          userId_lessonId: {
            userId: lessonAttempt.userId,
            lessonId: lesson.id,
          },
        },
        select: { completedAt: true },
      }),
      tx.userStats.findUnique({
        where: { userId: lessonAttempt.userId },
        select: { energy: true },
      }),
    ]);

    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    return {
      attemptId: lessonAttempt.id,
      status: lessonAttempt.status,
      energy: stats.energy,
      isReplay: progress !== null,
      lesson,
    };
  }
}
