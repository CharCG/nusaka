import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsUUID, ValidateNested } from 'class-validator';

export class ExerciseAnswerDto {
  @IsNotEmpty()
  @IsUUID()
  exerciseId: string;

  @IsNotEmpty()
  @IsObject()
  answer: Record<string, unknown>;
}

export class FinishLessonAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseAnswerDto)
  answers: ExerciseAnswerDto[];
}
