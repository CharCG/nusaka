import { Module } from '@nestjs/common';
import { VocabulariesService } from './vocabularies.service.js';
import { VocabulariesController } from './vocabularies.controller.js';

@Module({
  providers: [VocabulariesService],
  controllers: [VocabulariesController]
})
export class VocabulariesModule {}
