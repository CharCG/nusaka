import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { VocabulariesService } from './vocabularies.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@Controller('vocabularies')
@UseGuards(JwtAuthGuard)
export class VocabulariesController {
  constructor(private readonly vocabulariesService: VocabulariesService) {}

  @Get('languages/:languageCode/vocabularies')
  findByLanguage(@Param('languageCode') languageCode: string) {
    return this.vocabulariesService.findByLanguage(languageCode);
  }

  @Get(':vocabularyId')
  findOne(@Param('vocabularyId', ParseUUIDPipe) vocabularyId: string) {
    return this.vocabulariesService.findOne(vocabularyId);
  }
}
