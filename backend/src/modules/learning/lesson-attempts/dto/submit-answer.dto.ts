import { IsNotEmpty, IsObject, IsUUID } from 'class-validator';
import { Prisma } from '../../../../generated/prisma/client.js';

export class SubmitAnswerDto {
  @IsNotEmpty()
  @IsUUID()
  exerciseId: string;

  @IsNotEmpty()
  @IsObject()
  answer: Prisma.JsonObject;
}
