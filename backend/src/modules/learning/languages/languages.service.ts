import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class LanguagesService {
  constructor(private readonly prismaService: PrismaService) {}
}
