import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../common/dto/current-user.dto.js';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('daily')
  getDailyRewardStatus(@CurrentUser() user: CurrentUserDto) {
    return this.rewardsService.getDailyRewardStatus(user.id);
  }

  @Post('daily/claim')
  @HttpCode(HttpStatus.OK)
  claimDailyReward(@CurrentUser() user: CurrentUserDto) {
    return this.rewardsService.claimDailyReward(user.id);
  }
}
