import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prismaService: PrismaService) {}
}
