import { Module } from '@nestjs/common';
import { StoriesService } from './stories.service.js';
import { StoriesController } from './stories.controller.js';

@Module({
  imports: [],
  providers: [StoriesService],
  controllers: [StoriesController],
})
export class StoriesModule {}
