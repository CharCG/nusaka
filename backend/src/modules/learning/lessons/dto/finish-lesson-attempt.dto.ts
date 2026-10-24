import { IsBoolean, IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class FinishLessonAttemptDto {
  @IsNotEmpty()
  @IsBoolean()
  completed: boolean;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  mistakes: number;
}
