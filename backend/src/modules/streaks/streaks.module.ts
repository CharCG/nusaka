import { Module } from '@nestjs/common';
import { StreaksService } from './streaks.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
