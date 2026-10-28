import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prismaService.user.findUnique({
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
        inventory: {
          select: { streakFreeze: true },
        },
        achievements: {
          select: {
            unlockedAt: true,
            achievement: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: { unlockedAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      return await this.prismaService.user.update({
        where: { id: userId },
        data: {
          ...(dto.username !== undefined && {
            username: dto.username.trim().toLowerCase(),
          }),
          ...(dto.nickname !== undefined && {
            nickname: dto.nickname?.trim() || null,
          }),
        },
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
          inventory: {
            select: { streakFreeze: true },
          },
          achievements: {
            select: {
              unlockedAt: true,
              achievement: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  description: true,
                },
              },
            },
            orderBy: { unlockedAt: 'asc' },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Username is already taken');
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
      }

      throw error;
    }
  }
}
