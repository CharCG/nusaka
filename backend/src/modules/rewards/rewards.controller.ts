import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {}
