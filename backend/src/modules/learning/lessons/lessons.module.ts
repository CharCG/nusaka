import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';
import { StreaksModule } from '../../streaks/streaks.module.js';

@Module({
  imports: [StreaksModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
