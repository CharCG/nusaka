import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserStatsService } from '../user-stats/user-stats.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userStatsService: UserStatsService,
  ) {}

  findMe(userId: string) {
    return this.prismaService.$transaction(async (tx) => {
      await this.userStatsService.recoverLives(tx, userId);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          role: true,
          createdAt: true,
          stats: {
            select: {
              xp: true,
              lives: true,
              gems: true,
              currentStreak: true,
              longestStreak: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    });
  }
}
