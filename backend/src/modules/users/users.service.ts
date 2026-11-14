import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { Prisma } from '../../generated/prisma/client.js';

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
            energy: true,
            gems: true,
          },
        },
        inventory: true,
        achievements: {
          select: {
            unlockedAt: true,
            achievement: {
              select: {
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
      await this.prismaService.user.update({
        where: { id: userId },
        data: {
          username: dto.username?.trim().toLowerCase(),
          nickname: dto.nickname?.trim(),
        },
        select: { id: true },
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

    return this.getProfile(userId);
  }
}
