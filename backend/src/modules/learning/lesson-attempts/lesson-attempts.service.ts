import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IdempotencyService } from '../../idempotency/idempotency.service.js';
import { UserStatsService } from '../../user-stats/user-stats.service.js';
import { StartLessonAttemptDto } from './dto/start-lesson-attempt.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { LessonAttemptStatus } from '../../../generated/prisma/enums.js';
import { isCorrectAnswer } from './validators/exercise-answer.validator.js';

@Injectable()
export class LessonAttemptsService {
  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly userStatsService: UserStatsService,
  ) {}

  start(userId: string, key: string, dto: StartLessonAttemptDto) {
    return this.idempotencyService.run({
      userId,
      key,
      operation: 'lesson-attempts.start',
      request: { lessonId: dto.lessonId },
      execute: async (tx) => {
        const stats = await this.userStatsService.recoverLives(tx, userId);

        if (stats.lives < 1) {
          throw new ConflictException('Not enough lives to start a lesson attempt');
        }

        const lesson = await tx.lesson.findUnique({
          where: {
            id: dto.lessonId,
          },
          select: {
            chapter: {
              select: {
                unit: {
                  select: { languageId: true },
                },
              },
            },
          },
        });

        if (!lesson) {
          throw new NotFoundException('Lesson not found');
        }

        const language = await tx.language.findUniqueOrThrow({
          where: {
            id: lesson.chapter.unit.languageId,
          },
          select: {
            units: {
              orderBy: { order: 'asc' },
              select: {
                chapters: {
                  orderBy: { order: 'asc' },
                  select: {
                    lessons: {
                      orderBy: { order: 'asc' },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        });

        const lessonIds = language.units.flatMap((unit) =>
          unit.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
        );

        const lessonIndex = lessonIds.indexOf(dto.lessonId);

        if (lessonIndex === -1) {
          throw new NotFoundException('Lesson not found in the language');
        }

        if (lessonIndex > 0) {
          const progress = await tx.lessonProgress.findFirst({
            where: {
              userId,
              lessonId: {
                in: [dto.lessonId, lessonIds[lessonIndex - 1]],
              },
            },
            select: { lessonId: true },
          });

          if (!progress) {
            throw new ForbiddenException('Lesson is locked');
          }
        }

        const exercises = await tx.exercise.findMany({
          where: { lessonId: dto.lessonId },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            type: true,
            order: true,
            question: true,
          },
        });

        if (exercises.length === 0) {
          throw new ConflictException('Lesson has no exercises');
        }

        if (exercises.some((exercise, index) => exercise.order !== index + 1)) {
          throw new ConflictException('Exercise orders must be consecutive starting from 1');
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

        const lessonAttempt = await tx.lessonAttempt.create({
          data: {
            userId,
            lessonId: dto.lessonId,
          },
        });

        return {
          id: lessonAttempt.id,
          lessonId: lessonAttempt.lessonId,
          status: lessonAttempt.status,
          currentExerciseOrder: lessonAttempt.currentExerciseOrder,
          totalExercises: exercises.length,
          exercise: exercises[0],
          lives: stats.lives,
        };
      },
    });
  }

  answer(userId: string, key: string, lessonAttemptId: string, dto: SubmitAnswerDto) {
    return this.idempotencyService.run({
      userId,
      key,
      operation: 'lesson-attempts.answer',
      request: {
        lessonAttemptId,
        exerciseId: dto.exerciseId,
        answer: dto.answer,
      },
      execute: async (tx) => {
        const stats = await this.userStatsService.recoverLives(tx, userId);

        const lessonAttempt = await tx.lessonAttempt.findFirst({
          where: {
            id: lessonAttemptId,
            userId,
          },
        });

        if (!lessonAttempt) {
          throw new NotFoundException('Lesson attempt not found');
        }

        if (lessonAttempt.status !== LessonAttemptStatus.IN_PROGRESS) {
          throw new ForbiddenException('Lesson attempt is not active');
        }

        if (stats.lives < 1) {
          throw new ConflictException('Not enough lives to submit an answer');
        }

        const exercise = await tx.exercise.findUnique({
          where: {
            lessonId_order: {
              lessonId: lessonAttempt.lessonId,
              order: lessonAttempt.currentExerciseOrder,
            },
          },
          select: {
            id: true,
            type: true,
            order: true,
            question: true,
            answer: true,
          },
        });

        if (!exercise || exercise.id !== dto.exerciseId) {
          throw new ConflictException('Exercise is not active');
        }

        const totalExercises = await tx.exercise.count({
          where: { lessonId: lessonAttempt.lessonId },
        });

        const isCorrect = isCorrectAnswer(exercise.type, dto.answer, exercise.answer);

        if (!isCorrect) {
          const updatedStats = await tx.userStats.update({
            where: { userId },
            data: {
              lives: { decrement: 1 },
            },
            select: { lives: true },
          });

          const failed = updatedStats.lives === 0;

          await tx.lessonAttempt.update({
            where: { id: lessonAttemptId },
            data: {
              mistakes: { increment: 1 },
              ...(failed && {
                status: LessonAttemptStatus.FAILED,
                finishedAt: new Date(),
              }),
            },
          });

          return {
            correct: false,
            status: failed ? LessonAttemptStatus.FAILED : LessonAttemptStatus.IN_PROGRESS,
            currentExerciseOrder: failed ? null : lessonAttempt.currentExerciseOrder,
            totalExercises,
            exercise: failed
              ? null
              : {
                  id: exercise.id,
                  type: exercise.type,
                  order: exercise.order,
                  question: exercise.question,
                },
            lives: updatedStats.lives,
          };
        }

        if (lessonAttempt.currentExerciseOrder < totalExercises) {
          const nextExercise = await tx.exercise.findUnique({
            where: {
              lessonId_order: {
                lessonId: lessonAttempt.lessonId,
                order: lessonAttempt.currentExerciseOrder + 1,
              },
            },
            select: {
              id: true,
              type: true,
              order: true,
              question: true,
            },
          });

          if (!nextExercise) {
            throw new ConflictException('Next exercise not found');
          }

          await tx.lessonAttempt.update({
            where: { id: lessonAttemptId },
            data: {
              currentExerciseOrder: { increment: 1 },
            },
          });

          return {
            correct: true,
            status: LessonAttemptStatus.IN_PROGRESS,
            currentExerciseOrder: nextExercise.order,
            totalExercises,
            exercise: nextExercise,
            lives: stats.lives,
          };
        }

        const isPerfect = lessonAttempt.mistakes === 0;
        const finishedAt = new Date();

        await tx.lessonAttempt.update({
          where: { id: lessonAttemptId },
          data: {
            status: LessonAttemptStatus.COMPLETED,
            finishedAt,
          },
        });

        const completion = await tx.lessonProgress.createMany({
          data: {
            userId,
            lessonId: lessonAttempt.lessonId,
            isPerfect,
            completedAt: finishedAt,
          },
          skipDuplicates: true,
        });

        const firstCompletion = completion.count === 1;

        if (!firstCompletion && isPerfect) {
          await tx.lessonProgress.update({
            where: {
              userId_lessonId: {
                userId,
                lessonId: lessonAttempt.lessonId,
              },
            },
            data: { isPerfect: true },
          });
        }

        const reward = {
          xp: firstCompletion ? (isPerfect ? 15 : 10) : 0,
          lives: firstCompletion ? 5 : 0,
          gems: firstCompletion ? 5 : 0,
        };

        let remainingLives = stats.lives;

        if (firstCompletion) {
          const updatedStats = await tx.userStats.update({
            where: { userId },
            data: {
              xp: { increment: reward.xp },
              lives: { increment: reward.lives },
              gems: { increment: reward.gems },
            },
            select: { lives: true },
          });

          remainingLives = updatedStats.lives;
        }

        return {
          correct: true,
          status: LessonAttemptStatus.COMPLETED,
          currentExerciseOrder: null,
          totalExercises,
          exercise: null,
          firstCompletion,
          isPerfect,
          reward,
          lives: remainingLives,
        };
      },
    });
  }

  abandon(userId: string, key: string, lessonAttemptId: string) {
    return this.idempotencyService.run({
      userId,
      key,
      operation: 'lesson-attempts.abandon',
      request: { lessonAttemptId },
      execute: async (tx) => {
        await this.userStatsService.lockStats(tx, userId);

        const lessonAttempt = await tx.lessonAttempt.findFirst({
          where: {
            id: lessonAttemptId,
            userId,
          },
        });

        if (!lessonAttempt) {
          throw new NotFoundException('Lesson attempt not found');
        }

        if (lessonAttempt.status !== 'IN_PROGRESS') {
          throw new ConflictException('Lesson attempt is not active');
        }

        const finishedAt = new Date();

        await tx.lessonAttempt.update({
          where: { id: lessonAttemptId },
          data: {
            status: LessonAttemptStatus.ABANDONED,
            finishedAt,
          },
        });

        return {
          id: lessonAttempt.id,
          status: LessonAttemptStatus.ABANDONED,
          finishedAt: finishedAt.toISOString(),
        };
      },
    });
  }
}
