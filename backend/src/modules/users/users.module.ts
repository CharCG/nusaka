import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UserStatsModule } from '../user-stats/user-stats.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PrismaModule, UserStatsModule, StreaksModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
