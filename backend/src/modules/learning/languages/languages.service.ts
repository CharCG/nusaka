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
}
