import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class VocabulariesService {
  constructor(private readonly prismaService: PrismaService) {}

  async findByLanguage(languageCode: string) {
    const language = await this.prismaService.language.findUnique({
      where: { code: languageCode },
      select: { id: true },
    });

    if (!language) {
      throw new NotFoundException('Language not found');
    }

    return this.prismaService.vocabulary.findMany({
      where: { languageId: language.id },
      orderBy: [{ word: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(vocabularyId: string) {
    const vocabulary = await this.prismaService.vocabulary.findUnique({
      where: { id: vocabularyId },
    });

    if (!vocabulary) {
      throw new NotFoundException('Vocabulary not found');
    }

    return vocabulary;
  }
}
