import { Module } from '@nestjs/common';
import { EnergiesService } from './energies.service.js';

@Module({
  providers: [EnergiesService],
})
export class EnergiesModule {}
