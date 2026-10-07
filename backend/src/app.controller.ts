import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Controller()
export class AppController {
  @Get('health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
