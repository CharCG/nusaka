import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserDto } from '../../common/dto/current-user.dto.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUserDto => {
  const request = ctx.switchToHttp().getRequest<{ user: CurrentUserDto }>();
  return request.user;
});
