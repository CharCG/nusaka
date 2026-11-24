import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { QuestsService } from './quests.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../common/dto/current-user.dto.js';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  findQuests(@CurrentUser() user: CurrentUserDto) {
    return this.questsService.findQuests(user.id);
  }

  @Post(':questId/claim')
  @HttpCode(HttpStatus.OK)
  claimQuest(@CurrentUser() user: CurrentUserDto, @Param('questId', ParseUUIDPipe) questId: string) {
    return this.questsService.claimQuest(user.id, questId);
  }
}
