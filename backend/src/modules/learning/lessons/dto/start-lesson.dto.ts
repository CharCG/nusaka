import { IsNotEmpty, IsUUID } from 'class-validator';

export class StartLessonDto {
  @IsNotEmpty()
  @IsUUID()
  requestId: string;
}
