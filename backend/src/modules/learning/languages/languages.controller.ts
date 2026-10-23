import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LanguagesService } from './languages.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@Controller('languages')
@UseGuards(JwtAuthGuard)
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  findAll() {
    return this.languagesService.findAll();
  }

  @Get(':code/path')
  findPath(@Param('code') code: string) {
    return this.languagesService.findPath(code);
  }
}
