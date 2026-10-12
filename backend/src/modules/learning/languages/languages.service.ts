import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class LanguagesService {
  constructor(private readonly prismaService: PrismaService) {}

  findAll() {
    return this.prismaService.language.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const language = await this.prismaService.language.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        units: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            title: true,
            order: true,
          },
        },
      },
    });

    if (!language) {
      throw new NotFoundException('Language not found');
    }

    return language;
  }

  async findPath(userId: string, id: string) {
    const language = await this.prismaService.language.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        units: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            chapters: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
                lessons: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    order: true,
                    _count: {
                      select: { exercises: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!language) {
      throw new NotFoundException('Language not found');
    }

    const lessonIds = language.units.flatMap((unit) =>
      unit.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
    );

    const progresses = await this.prismaService.lessonProgress.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
      },
      select: {
        lessonId: true,
        isPerfect: true,
      },
    });

    const completed = new Map(progresses.map((progress) => [progress.lessonId, progress.isPerfect]));

    let previousCompleted = true;

    return {
      ...language,
      units: language.units.map((unit) => ({
        ...unit,
        chapters: unit.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) => {
            const isCompleted = completed.has(lesson.id);
            const isUnlocked = previousCompleted || isCompleted;
            const isPerfect = completed.get(lesson.id) ?? false;

            previousCompleted = isCompleted;

            return {
              ...lesson,
              isUnlocked,
              isCompleted,
              isPerfect,
            };
          }),
        })),
      })),
    };
  }
}
