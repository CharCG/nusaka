import { IsNotEmpty, IsUUID } from 'class-validator';

export class StartLessonAttemptDto {
  @IsNotEmpty()
  @IsUUID()
  lessonId: string;
}
