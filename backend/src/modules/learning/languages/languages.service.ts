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

  async findPath(code: string) {
    const language = await this.prismaService.language.findUnique({
      where: { code },
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

    return language;
  }
}
