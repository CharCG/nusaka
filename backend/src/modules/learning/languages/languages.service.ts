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
      orderBy: { name: 'asc' },
    });
  }

  async findPath(userId: string, languageCode: string) {
    const language = await this.prismaService.language.findUnique({
      where: { code: languageCode },
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
                    progresses: {
                      where: { userId },
                      select: { completedAt: true },
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

    let previousLessonCompleted = true;

    return {
      id: language.id,
      code: language.code,
      name: language.name,
      units: language.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        order: unit.order,
        chapters: unit.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          order: chapter.order,
          lessons: chapter.lessons.map((lesson) => {
            const isCompleted = lesson.progresses.length > 0;
            const isUnlocked = previousLessonCompleted || isCompleted;

            previousLessonCompleted = isCompleted;

            return {
              id: lesson.id,
              title: lesson.title,
              order: lesson.order,
              _count: lesson._count,
              isUnlocked,
              isCompleted,
            };
          }),
        })),
      })),
    };
  }
}
