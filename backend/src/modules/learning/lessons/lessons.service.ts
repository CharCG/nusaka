import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StartLessonDto } from './dto/start-lesson.dto.js';
import { FinishLessonAttemptDto } from './dto/finish-lesson-attempt.dto.js';
import { LessonAttempt, Prisma } from '../../../generated/prisma/client.js';

@Injectable()
export class LessonsService {
  constructor(private readonly prismaService: PrismaService) {}

  async startLesson(userId: string, lessonId: string, dto: StartLessonDto) {
    try {
      return await this.prismaService.withTransactionRetry(async (tx) => {
        const existingAttempt = await tx.lessonAttempt.findUnique({
          where: {
            userId_requestId: {
              userId,
              requestId: dto.requestId,
            },
          },
        });

        if (existingAttempt) {
          return this.startResponse(tx, existingAttempt, lessonId);
        }

        const stats = await tx.userStats.findUnique({
          where: { userId },
          select: { lives: true },
        });

        if (!stats) {
          throw new NotFoundException('User stats not found');
        }

        if (stats.lives < 1) {
          throw new BadRequestException('At least 1 life is required to start a lesson');
        }

        const lesson = await tx.lesson.findUnique({
          where: { id: lessonId },
          select: {
            id: true,
            order: true,
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

        const currentProgress = await tx.lessonProgress.findUnique({
          where: {
            userId_lessonId: {
              userId,
              lessonId,
            },
          },
        });

        if (!currentProgress) {
          const chapter = lesson.chapter;
          const unit = chapter.unit;

          const previousLesson = await tx.lesson.findFirst({
            where: {
              chapter: {
                unit: {
                  languageId: unit.languageId,
                },
              },
              OR: [
                {
                  chapter: {
                    unit: {
                      order: { lt: unit.order },
                    },
                  },
                },
                {
                  chapter: {
                    unitId: unit.id,
                    order: { lt: chapter.order },
                  },
                },
                {
                  chapterId: chapter.id,
                  order: { lt: lesson.order },
                },
              ],
            },
            orderBy: [
              {
                chapter: {
                  unit: { order: 'desc' },
                },
              },
              { chapter: { order: 'desc' } },
              { order: 'desc' },
            ],
            select: { id: true },
          });

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
            status: 'IN_PROGRESS',
          },
          data: {
            status: 'ABANDONED',
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

        return this.startResponse(tx, attempt, lessonId);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prismaService.withTransactionRetry(async (tx) => {
          const existingAttempt = await tx.lessonAttempt.findUnique({
            where: {
              userId_requestId: {
                userId,
                requestId: dto.requestId,
              },
            },
          });

          if (!existingAttempt) {
            throw error;
          }

          return this.startResponse(tx, existingAttempt, lessonId);
        });
      }

      throw error;
    }
  }

  async finishLessonAttempt(userId: string, lessonAttemptId: string, dto: FinishLessonAttemptDto) {
    return this.prismaService.withTransactionRetry(async (tx) => {
      const attempt = await tx.lessonAttempt.findFirst({
        where: {
          id: lessonAttemptId,
          userId,
        },
      });

      if (!attempt) {
        throw new NotFoundException('Lesson attempt not found');
      }

      if (attempt.status !== 'IN_PROGRESS') {
        return this.finishResponse(tx, attempt);
      }

      if (dto.mistakes > attempt.initialLives) {
        throw new BadRequestException('Mistakes cannot exceed the initial Lives');
      }

      if (dto.completed && dto.mistakes >= attempt.initialLives) {
        throw new BadRequestException('Lesson cannot be completed after running out of Lives');
      }

      const stats = await tx.userStats.findUnique({
        where: { userId },
        select: { lives: true },
      });

      if (!stats) {
        throw new NotFoundException('User stats not found');
      }

      if (stats.lives < dto.mistakes) {
        throw new ConflictException('Lives have changed and are insufficient for this result');
      }

      const status = dto.completed ? 'COMPLETED' : dto.mistakes === attempt.initialLives ? 'FAILED' : 'ABANDONED';

      let firstCompletion = false;

      if (status === 'COMPLETED') {
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

      const xpReward = firstCompletion ? 10 + (dto.mistakes === 0 ? 5 : 0) : 0;
      const livesReward = firstCompletion ? 5 : 0;
      const gemsReward = firstCompletion ? 5 : 0;

      await tx.userStats.update({
        where: { userId },
        data: {
          xp: { increment: xpReward },
          lives: { increment: livesReward - dto.mistakes },
          gems: { increment: gemsReward },
        },
      });

      const finishedAttempt = await tx.lessonAttempt.update({
        where: { id: attempt.id },
        data: {
          status,
          mistakes: dto.mistakes,
          finishedAt: new Date(),
        },
      });

      return this.finishResponse(tx, finishedAttempt);
    });
  }

  private async startResponse(tx: Prisma.TransactionClient, attempt: LessonAttempt, lessonId: string) {
    if (attempt.lessonId !== lessonId) {
      throw new ConflictException('Request ID has already been used for another lesson');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('This session has ended. Use a new request ID to start again');
    }

    const lesson = await tx.lesson.findUniqueOrThrow({
      where: { id: attempt.lessonId },
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

    const progress = await tx.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: attempt.userId,
          lessonId: attempt.lessonId,
        },
      },
    });

    return {
      attemptId: attempt.id,
      status: attempt.status,
      lives: attempt.initialLives,
      isReplay: progress !== null,
      lesson,
    };
  }

  private async finishResponse(tx: Prisma.TransactionClient, attempt: LessonAttempt) {
    const stats = await tx.userStats.findUnique({
      where: { userId: attempt.userId },
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
      attemptId: attempt.id,
      lessonId: attempt.lessonId,
      status: attempt.status,
      mistakes: attempt.mistakes,
      isPerfect: attempt.status === 'COMPLETED' && attempt.mistakes === 0,
      finishedAt: attempt.finishedAt,
      stats,
    };
  }
}
