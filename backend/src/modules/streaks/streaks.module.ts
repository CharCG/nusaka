import { Module } from '@nestjs/common';
import { UserStatsModule } from '../user-stats/user-stats.module.js';
import { StreaksService } from './streaks.service.js';

@Module({
  imports: [UserStatsModule],
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
