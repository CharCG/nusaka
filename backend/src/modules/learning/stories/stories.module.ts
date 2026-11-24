import { Module } from '@nestjs/common';
import { StoriesService } from './stories.service.js';
import { StoriesController } from './stories.controller.js';
import { StreaksModule } from '../../streaks/streaks.module.js';
import { QuestsModule } from '../../quests/quests.module.js';

@Module({
  imports: [StreaksModule, QuestsModule],
  providers: [StoriesService],
  controllers: [StoriesController],
})
export class StoriesModule {}
