import { Controller, UseGuards } from '@nestjs/common';
import { UserStatsService } from './user-stats.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('user-stats')
@UseGuards(JwtAuthGuard)
export class UserStatsController {
  constructor(private readonly userStatsService: UserStatsService) {}
}
