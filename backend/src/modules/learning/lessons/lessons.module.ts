import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { StreaksModule } from '../../streaks/streaks.module.js';

@Module({
  imports: [PrismaModule, StreaksModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
