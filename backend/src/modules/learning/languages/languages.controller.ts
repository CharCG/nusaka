import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { LanguagesService } from './languages.service.js';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  findAll() {
    return this.languagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.languagesService.findOne(id);
  }

  @Get(':id/path')
  findPath(@Param('id', ParseUUIDPipe) id: string) {
    return this.languagesService.findPath(id);
  }
}
