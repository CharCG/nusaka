import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { Paginated } from '../../common/dto/paginated-response.dto.js';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async findLeaderboard(dto: PaginationQueryDto) {
    const [entries, total] = await Promise.all([
      this.prismaService.userStats.findMany({
        select: {
          userId: true,
          xp: true,
          currentStreak: true,
          user: {
            select: {
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: [{ xp: 'desc' }, { user: { username: 'asc' } }],
        skip: dto.skip,
        take: dto.limit,
      }),
      this.prismaService.userStats.count(),
    ]);

    const items = entries.map(({ userId, xp, currentStreak, user }, index) => ({
      rank: dto.skip + index + 1,
      userId,
      username: user.username,
      nickname: user.nickname,
      xp,
      currentStreak,
    }));

    return new Paginated(items, total, dto.page, dto.limit);
  }
}
