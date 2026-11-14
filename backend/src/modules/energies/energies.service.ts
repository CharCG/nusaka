import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EnergiesService {
  constructor(private readonly prismaService: PrismaService) {}
}
