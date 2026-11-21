import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseItemDto } from './dto/purchase-item.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, ShopItemType, type ShopPurchase } from '../../generated/prisma/client.js';

@Injectable()
export class ShopService {
  constructor(private readonly prismaService: PrismaService) {}

  findItems() {
    return this.prismaService.shopItem.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        code: true,
        type: true,
        name: true,
        description: true,
        amount: true,
        price: true,
      },
    });
  }

  async purchaseItem(userId: string, itemId: string, dto: PurchaseItemDto) {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const existingPurchase = await tx.shopPurchase.findUnique({
            where: {
              userId_requestId: {
                userId,
                requestId: dto.requestId,
              },
            },
          });

          if (existingPurchase) {
            return this.purchaseResponse(tx, existingPurchase, itemId);
          }

          const item = await tx.shopItem.findUnique({
            where: { id: itemId },
          });

          if (!item || !item.isActive) {
            throw new NotFoundException('Shop item not found');
          }

          if (item.type === ShopItemType.GEMS) {
            throw new BadRequestException('Shop item not purchasable');
          }

          const stats = await tx.userStats.findUnique({
            where: { userId },
            select: { gems: true },
          });

          if (!stats) {
            throw new NotFoundException('User stats not found');
          }

          if (stats.gems < item.price) {
            throw new BadRequestException('Not enough gems to purchase the item');
          }

          await tx.userStats.update({
            where: { userId },
            data: {
              gems: { decrement: item.price },
            },
          });

          await this.grantItem(tx, userId, item.type, item.amount);

          const purchase = await tx.shopPurchase.create({
            data: {
              userId,
              shopItemId: item.id,
              requestId: dto.requestId,
              type: item.type,
              amount: item.amount,
              price: item.price,
            },
          });

          return this.purchaseResponse(tx, purchase, itemId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
        throw new ConflictException('Unable to complete the purchase. Please try again');
      }

      throw error;
    }
  }

  private async grantItem(tx: Prisma.TransactionClient, userId: string, type: ShopItemType, amount: number) {
    switch (type) {
      case ShopItemType.ENERGY:
        await tx.userStats.update({
          where: { userId },
          data: {
            energy: { increment: amount },
          },
        });
        return;
      case ShopItemType.GEMS:
        await tx.userStats.update({
          where: { userId },
          data: {
            gems: { increment: amount },
          },
        });
        return;
      case ShopItemType.STREAK_FREEZE:
        await tx.userInventory.update({
          where: { userId },
          data: {
            streakFreeze: { increment: amount },
          },
        });
        return;
    }
  }

  private async purchaseResponse(tx: Prisma.TransactionClient, purchase: ShopPurchase, itemId: string) {
    if (purchase.shopItemId !== itemId) {
      throw new ConflictException('Request ID has already been used. Please try again with new request ID');
    }

    const stats = await tx.userStats.findUniqueOrThrow({
      where: { userId: purchase.userId },
      select: { energy: true, gems: true },
    });

    const inventory = await tx.userInventory.findUniqueOrThrow({
      where: { userId: purchase.userId },
      select: { streakFreeze: true },
    });

    return {
      purchaseId: purchase.id,
      item: {
        id: purchase.shopItemId,
        type: purchase.type,
        amount: purchase.amount,
        price: purchase.price,
      },
      stats,
      inventory,
    };
  }
}
