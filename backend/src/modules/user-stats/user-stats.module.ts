import { Module } from '@nestjs/common';
import { UserStatsService } from './user-stats.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [UserStatsService],
  exports: [UserStatsService],
})
export class UserStatsModule {}
