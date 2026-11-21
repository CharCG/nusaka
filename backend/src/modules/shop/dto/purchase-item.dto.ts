import { IsNotEmpty, IsUUID } from 'class-validator';

export class PurchaseItemDto {
  @IsNotEmpty()
  @IsUUID()
  requestId: string;
}
