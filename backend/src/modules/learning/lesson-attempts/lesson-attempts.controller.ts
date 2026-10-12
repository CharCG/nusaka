import { Body, Controller, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { LessonAttemptsService } from './lesson-attempts.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../auth/dto/current-user.dto.js';
import { StartLessonAttemptDto } from './dto/start-lesson-attempt.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';

@Controller('lesson-attempts')
@UseGuards(JwtAuthGuard)
export class LessonAttemptsController {
  constructor(private readonly lessonAttemptsService: LessonAttemptsService) {}

  @Post()
  async start(
    @CurrentUser() user: CurrentUserDto,
    @Headers('idempotency-key') key: string,
    @Body() dto: StartLessonAttemptDto,
  ) {
    return this.lessonAttemptsService.start(user.id, key, dto);
  }

  @Post(':id/answers')
  @HttpCode(HttpStatus.OK)
  async answer(
    @CurrentUser() user: CurrentUserDto,
    @Headers('idempotency-key') key: string,
    @Param('id', ParseUUIDPipe) lessonAttemptId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.lessonAttemptsService.answer(user.id, key, lessonAttemptId, dto);
  }

  @Post(':id/abandon')
  @HttpCode(HttpStatus.OK)
  async abandon(
    @CurrentUser() user: CurrentUserDto,
    @Headers('idempotency-key') key: string,
    @Param('id', ParseUUIDPipe) lessonAttemptId: string,
  ) {
    return this.lessonAttemptsService.abandon(user.id, key, lessonAttemptId);
  }
}
