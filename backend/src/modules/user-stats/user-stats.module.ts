import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UserStatsController } from './user-stats.controller.js';
import { UserStatsService } from './user-stats.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [UserStatsController],
  providers: [UserStatsService],
  exports: [UserStatsService],
})
export class UserStatsModule {}
