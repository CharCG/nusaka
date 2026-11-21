import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { PurchaseItemDto } from './dto/purchase-item.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../../common/dto/current-user.dto.js';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  findItems() {
    return this.shopService.findItems();
  }

  @Post('items/:itemId/purchase')
  @HttpCode(HttpStatus.OK)
  purchaseItem(
    @CurrentUser() user: CurrentUserDto,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: PurchaseItemDto,
  ) {
    return this.shopService.purchaseItem(user.id, itemId, dto);
  }
}
