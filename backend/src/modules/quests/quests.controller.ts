import { Controller, UseGuards } from '@nestjs/common';
import { QuestsService } from './quests.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}
}
