import { Module } from '@nestjs/common';
import { LivesService } from './lives.service.js';

@Module({
  providers: [LivesService],
})
export class LivesModule {}
