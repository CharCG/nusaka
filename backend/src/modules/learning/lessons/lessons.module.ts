import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';
import { StreaksModule } from '../../streaks/streaks.module.js';
import { QuestsModule } from '../../quests/quests.module.js';

@Module({
  imports: [StreaksModule, QuestsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
