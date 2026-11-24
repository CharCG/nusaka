import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class QuestsService {
  constructor(private readonly prismaService: PrismaService) {}
}
