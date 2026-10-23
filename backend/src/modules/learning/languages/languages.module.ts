import { Module } from '@nestjs/common';
import { LanguagesController } from './languages.controller.js';
import { LanguagesService } from './languages.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [LanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
