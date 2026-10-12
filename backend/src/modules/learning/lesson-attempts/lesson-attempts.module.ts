import { Module } from '@nestjs/common';
import { LessonAttemptsController } from './lesson-attempts.controller.js';
import { LessonAttemptsService } from './lesson-attempts.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IdempotencyModule } from '../../idempotency/idempotency.module.js';
import { UserStatsModule } from '../../user-stats/user-stats.module.js';
import { StreaksModule } from '../../streaks/streaks.module.js';

@Module({
  imports: [PrismaModule, IdempotencyModule, UserStatsModule, StreaksModule],
  controllers: [LessonAttemptsController],
  providers: [LessonAttemptsService],
})
export class LessonAttemptsModule {}
