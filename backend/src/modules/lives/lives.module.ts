import { Module } from '@nestjs/common';
import { LivesService } from './lives.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [LivesService],
  exports: [LivesService],
})
export class LivesModule {}
