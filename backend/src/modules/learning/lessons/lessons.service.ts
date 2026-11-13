import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LESSON_COMPLETION_XP,
  LESSON_PERFECT_COMPLETION_BONUS_XP,
  LESSON_COMPLETION_LIVES,
  LESSON_COMPLETION_GEMS,
} from './lessons.constants.js';
import { evaluateAttempt } from './lessons.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StartLessonDto } from './dto/start-lesson.dto.js';
import { FinishLessonAttemptDto } from './dto/finish-lesson-attempt.dto.js';
import { LessonAttemptStatus, Prisma, type LessonAttempt } from '../../../generated/prisma/client.js';

@Injectable()
export class LessonsService {
  constructor(private readonly prismaService: PrismaService) {}

  async startLessonAttempt(userId: string, lessonId: string, dto: StartLessonDto) {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const existingAttempt = await tx.lessonAttempt.findUnique({
            where: {
              userId_requestId: {
                userId,
                requestId: dto.requestId,
              },
            },
          });

          if (existingAttempt) {
            return this.startLessonAttemptResponse(tx, existingAttempt, lessonId);
          }

          const stats = await tx.userStats.findUnique({
            where: { userId },
            select: { lives: true },
          });

          if (!stats) {
            throw new NotFoundException('User stats not found');
          }

          if (stats.lives < 1) {
            throw new BadRequestException('Not enough lives to start the lesson');
          }

          const lesson = await tx.lesson.findUnique({
            where: { id: lessonId },
            select: {
              id: true,
              chapter: {
                select: {
                  unit: {
                    select: { languageId: true },
                  },
                },
              },
              _count: {
                select: { exercises: true },
              },
            },
          });

          if (!lesson) {
            throw new NotFoundException('Lesson not found');
          }

          if (lesson._count.exercises === 0) {
            throw new BadRequestException('Lesson does not contain any exercises');
          }

          const progress = await tx.lessonProgress.findUnique({
            where: {
              userId_lessonId: {
                userId,
                lessonId,
              },
            },
          });

          if (!progress) {
            const path = await tx.lesson.findMany({
              where: {
                chapter: {
                  unit: {
                    languageId: lesson.chapter.unit.languageId,
                  },
                },
              },
              orderBy: [{ chapter: { unit: { order: 'asc' } } }, { chapter: { order: 'asc' } }, { order: 'asc' }],
              select: { id: true },
            });

            const currentIndex = path.findIndex((item) => item.id === lessonId);
            const previousLesson = path[currentIndex - 1];

            if (previousLesson) {
              const previousProgress = await tx.lessonProgress.findUnique({
                where: {
                  userId_lessonId: {
                    userId,
                    lessonId: previousLesson.id,
                  },
                },
              });

              if (!previousProgress) {
                throw new ForbiddenException('Lesson is locked');
              }
            }
          }

          await tx.lessonAttempt.updateMany({
            where: {
              userId,
              status: LessonAttemptStatus.IN_PROGRESS,
            },
            data: {
              status: LessonAttemptStatus.ABANDONED,
              finishedAt: new Date(),
            },
          });

          const attempt = await tx.lessonAttempt.create({
            data: {
              userId,
              lessonId,
              requestId: dto.requestId,
              initialLives: stats.lives,
            },
          });

          return this.startLessonAttemptResponse(tx, attempt, lessonId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
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
          return this.startLessonAttemptResponse(this.prismaService, existingAttempt, lessonId);
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Unable to start the lesson attempt. Please try again');
      }

      throw error;
    }
  }

  async finishLessonAttempt(userId: string, attemptId: string, dto: FinishLessonAttemptDto) {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
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
            return this.finishLessonAttemptResponse(tx, attempt);
          }

          const exercises = await tx.exercise.findMany({
            where: { lessonId: attempt.lessonId },
            orderBy: { order: 'asc' },
          });

          if (exercises.length === 0) {
            throw new BadRequestException('Lesson does not contain any exercises');
          }

          const result = evaluateAttempt(exercises, dto.answers, attempt.initialLives);

          const stats = await tx.userStats.findUnique({
            where: { userId },
            select: { lives: true },
          });

          if (!stats) {
            throw new NotFoundException('User stats not found');
          }

          if (stats.lives < result.mistakes) {
            throw new ConflictException('Lives have changed. Please try again');
          }

          const status = result.completed
            ? LessonAttemptStatus.COMPLETED
            : result.mistakes === attempt.initialLives
              ? LessonAttemptStatus.FAILED
              : LessonAttemptStatus.ABANDONED;

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
          }

          const xpReward = firstCompletion
            ? LESSON_COMPLETION_XP + (result.mistakes === 0 ? LESSON_PERFECT_COMPLETION_BONUS_XP : 0)
            : 0;
          const livesReward = firstCompletion ? LESSON_COMPLETION_LIVES : 0;
          const gemsReward = firstCompletion ? LESSON_COMPLETION_GEMS : 0;

          await tx.userStats.update({
            where: { userId },
            data: {
              xp: { increment: xpReward },
              lives: { increment: livesReward - result.mistakes },
              gems: { increment: gemsReward },
            },
          });

          const finishedAttempt = await tx.lessonAttempt.update({
            where: { id: attempt.id },
            data: {
              status,
              mistakes: result.mistakes,
              finishedAt: new Date(),
            },
          });

          return this.finishLessonAttemptResponse(tx, finishedAttempt);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Unable to finish the lesson attempt. Please try again');
      }

      throw error;
    }
  }

  private async startLessonAttemptResponse(
    tx: Prisma.TransactionClient,
    lessonAttempt: LessonAttempt,
    lessonId: string,
  ) {
    if (lessonAttempt.lessonId !== lessonId) {
      throw new ConflictException('Request ID has already been used. Please try again with new request ID');
    }

    if (lessonAttempt.status !== LessonAttemptStatus.IN_PROGRESS) {
      throw new ConflictException('Lesson attempt has ended. Please try again with new request ID');
    }

    const lesson = await tx.lesson.findUnique({
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
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const progress = await tx.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: lessonAttempt.userId,
          lessonId,
        },
      },
    });

    return {
      attemptId: lessonAttempt.id,
      status: lessonAttempt.status,
      initialLives: lessonAttempt.initialLives,
      isReplay: progress !== null,
      lesson,
    };
  }

  private async finishLessonAttemptResponse(tx: Prisma.TransactionClient, lessonAttempt: LessonAttempt) {
    const stats = await tx.userStats.findUnique({
      where: { userId: lessonAttempt.userId },
      select: {
        xp: true,
        lives: true,
        gems: true,
      },
    });

    if (!stats) {
      throw new NotFoundException('User stats not found');
    }

    return {
      attemptId: lessonAttempt.id,
      lessonId: lessonAttempt.lessonId,
      status: lessonAttempt.status,
      mistakes: lessonAttempt.mistakes,
      isPerfect: lessonAttempt.status === LessonAttemptStatus.COMPLETED && lessonAttempt.mistakes === 0,
      finishedAt: lessonAttempt.finishedAt,
      stats,
    };
  }
}
