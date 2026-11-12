import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../../common/dto/current-user.dto.js';
import { StartLessonDto } from './dto/start-lesson.dto.js';
import { FinishLessonAttemptDto } from './dto/finish-lesson-attempt.dto.js';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post(':lessonId/start')
  @HttpCode(HttpStatus.OK)
  startLessonAttempt(
    @CurrentUser() user: CurrentUserDto,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: StartLessonDto,
  ) {
    return this.lessonsService.startLessonAttempt(user.id, lessonId, dto);
  }

  @Post('attempts/:attemptId/finish')
  @HttpCode(HttpStatus.OK)
  finishLessonAttempt(
    @CurrentUser() user: CurrentUserDto,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: FinishLessonAttemptDto,
  ) {
    return this.lessonsService.finishLessonAttempt(user.id, attemptId, dto);
  }
}
