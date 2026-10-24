import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LanguagesService } from './languages.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../auth/dto/current-user.dto.js';

@Controller('languages')
@UseGuards(JwtAuthGuard)
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  findAll() {
    return this.languagesService.findAll();
  }

  @Get(':code/path')
  findPath(@CurrentUser() user: CurrentUserDto, @Param('code') code: string) {
    return this.languagesService.findPath(user.id, code);
  }
}
