import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { StoriesService } from './stories.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../auth/dto/current-user.dto.js';
import { FindStoriesQueryDto } from './dto/find-stories-query.dto.js';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}
  @Get()
  findAll(@CurrentUser() user: CurrentUserDto, @Query() dto: FindStoriesQueryDto) {
    return this.storiesService.findAll(user.id, dto);
  }

  @Get(':storyId/pages')
  findPages(@CurrentUser() user: CurrentUserDto, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.storiesService.findPages(user.id, storyId);
  }

  @Post(':storyId/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(@CurrentUser() user: CurrentUserDto, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.storiesService.unlock(user.id, storyId);
  }

  @Post(':storyId/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: CurrentUserDto, @Param('storyId', ParseUUIDPipe) storyId: string) {
    return this.storiesService.complete(user.id, storyId);
  }
}
