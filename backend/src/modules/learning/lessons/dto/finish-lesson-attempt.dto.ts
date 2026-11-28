import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class FinishLessonAttemptDto {
  @IsBoolean()
  completed: boolean;

  @IsInt()
  @Min(0)
  @Max(1000)
  mistakes: number;
}
