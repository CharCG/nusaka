import { BadRequestException } from '@nestjs/common';
import { ExerciseType } from '../../../../generated/prisma/enums.js';
import { z } from 'zod';
import type { Prisma } from '../../../../generated/prisma/client.js';

const idSchema = z.string().trim().min(1);

const optionSchema = z.object({
  optionId: idSchema,
});

const textSchema = z.object({
  text: z.string().trim().min(1),
});

const wordOrderSchema = z.object({
  tokenIds: z.array(idSchema).min(1),
});

const pairSchema = z.object({
  leftId: idSchema,
  rightId: idSchema,
});

const matchingSchema = z.object({
  pairs: z.array(pairSchema).min(1),
});

function parseAnswer<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new BadRequestException('Invalid answer format');
  }

  return result.data;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isCorrectAnswer(type: ExerciseType, submitted: Prisma.JsonValue, answer: Prisma.JsonValue): boolean {
  switch (type) {
    case ExerciseType.MULTIPLE_CHOICE: {
      const input = parseAnswer(optionSchema, submitted);
      const expected = z.object({ correctOptionId: idSchema }).parse(answer);

      return input.optionId === expected.correctOptionId;
    }

    case ExerciseType.TRANSLATION:
    case ExerciseType.FILL_BLANK: {
      const input = parseAnswer(textSchema, submitted);
      const expected = z.object({ acceptedAnswers: z.array(z.string().trim().min(1)).min(1) }).parse(answer);

      return expected.acceptedAnswers.some((value) => normalizeText(value) === normalizeText(input.text));
    }

    case ExerciseType.WORD_ORDER: {
      const input = parseAnswer(wordOrderSchema, submitted);
      const expected = z.object({ correctTokenIds: z.array(idSchema).min(1) }).parse(answer);

      return (
        input.tokenIds.length === expected.correctTokenIds.length &&
        input.tokenIds.every((id, index) => id === expected.correctTokenIds[index])
      );
    }

    case ExerciseType.MATCHING: {
      const input = parseAnswer(matchingSchema, submitted);
      const expected = z.object({ pairs: z.array(pairSchema).min(1) }).parse(answer);

      const correctPairs = new Map(expected.pairs.map((pair) => [pair.leftId, pair.rightId]));

      return (
        input.pairs.length === expected.pairs.length &&
        new Set(input.pairs.map((pair) => pair.leftId)).size === input.pairs.length &&
        input.pairs.every((pair) => correctPairs.get(pair.leftId) === pair.rightId)
      );
    }
  }
}
