import { BadRequestException } from '@nestjs/common';
import { type ExerciseAnswerDto } from './dto/finish-lesson-attempt.dto.js';
import { type Exercise } from '../../../generated/prisma/client.js';
import { z } from 'zod';

type LessonExercise = Pick<Exercise, 'id' | 'type' | 'order' | 'question' | 'answer'>;

const pairsSchema = z.array(
  z.object({
    leftId: z.string(),
    rightId: z.string(),
  }),
);

function parseAnswer<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new BadRequestException('Invalid exercise answer');
  }

  return result.data;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isCorrectAnswer(exercise: LessonExercise, answer: Record<string, unknown>): boolean {
  switch (exercise.type) {
    case 'MULTIPLE_CHOICE': {
      const submitted = parseAnswer(z.object({ selectedOptionId: z.string() }), answer);
      const key = z.object({ correctOptionId: z.string() }).parse(exercise.answer);

      return submitted.selectedOptionId === key.correctOptionId;
    }

    case 'TRANSLATION':
    case 'FILL_BLANK': {
      const submitted = parseAnswer(z.object({ text: z.string() }), answer);
      const key = z.object({ acceptedAnswers: z.array(z.string()).min(1) }).parse(exercise.answer);

      return key.acceptedAnswers.some((text) => normalizeText(text) === normalizeText(submitted.text));
    }

    case 'WORD_ORDER': {
      const submitted = parseAnswer(z.object({ tokenIds: z.array(z.string()) }), answer);
      const key = z.object({ correctTokenIds: z.array(z.string()) }).parse(exercise.answer);

      return (
        submitted.tokenIds.length === key.correctTokenIds.length &&
        submitted.tokenIds.every((id, index) => id === key.correctTokenIds[index])
      );
    }

    case 'MATCHING': {
      const submitted = parseAnswer(z.object({ pairs: pairsSchema }), answer);
      const key = z.object({ pairs: pairsSchema }).parse(exercise.answer);
      const uniqueLeftIds = new Set(submitted.pairs.map((pair) => pair.leftId));

      return (
        submitted.pairs.length === key.pairs.length &&
        uniqueLeftIds.size === submitted.pairs.length &&
        submitted.pairs.every((pair) =>
          key.pairs.some((expected) => expected.leftId === pair.leftId && expected.rightId === pair.rightId),
        )
      );
    }
  }
}

export function evaluateAttempt(exercises: LessonExercise[], answers: ExerciseAnswerDto[], initialLives: number) {
  const queue = [...exercises];
  let mistakes = 0;

  for (const entry of answers) {
    const exercise = queue[0];

    if (!exercise) {
      throw new BadRequestException('All exercises have already been completed');
    }

    if (mistakes >= initialLives) {
      throw new BadRequestException('Not enough lives remaining to continue the lesson attempt');
    }

    if (entry.exerciseId !== exercise.id) {
      throw new BadRequestException('Exercise answers are out of order');
    }

    queue.shift();

    if (!isCorrectAnswer(exercise, entry.answer)) {
      mistakes++;
      queue.push(exercise);
    }
  }

  return { mistakes, completed: queue.length === 0 };
}
