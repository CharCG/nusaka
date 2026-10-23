import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seedAchievements() {
  await prisma.achievement.upsert({
    where: { code: 'FIRST_STEP' },
    update: {
      name: 'First Step',
      description: '',
    },
    create: {
      code: 'FIRST_STEP',
      name: 'First Step',
      description: '',
    },
  });
}

async function seedLanguages() {
  const languages = [
    { code: 'jav', name: 'Jawa' },
    { code: 'sun', name: 'Sunda' },
    { code: 'mad', name: 'Madura' },
  ];

  for (const language of languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: { name: language.name },
      create: language,
    });
  }
}

async function seedLearning() {
  const language = await prisma.language.findUnique({
    where: { code: 'jav' },
    select: { id: true },
  });

  if (!language) {
    throw new Error(`Language 'jav' not found. Seed languages first.`);
  }

  const unit = await prisma.unit.upsert({
    where: {
      languageId_order: {
        languageId: language.id,
        order: 1,
      },
    },
    update: { title: 'Basics' },
    create: {
      languageId: language.id,
      title: 'Basics',
      order: 1,
    },
  });

  const chapter = await prisma.chapter.upsert({
    where: {
      unitId_order: {
        unitId: unit.id,
        order: 1,
      },
    },
    update: { title: 'Greetings' },
    create: {
      unitId: unit.id,
      title: 'Greetings',
      order: 1,
    },
  });

  const lesson = await prisma.lesson.upsert({
    where: {
      chapterId_order: {
        chapterId: chapter.id,
        order: 1,
      },
    },
    update: { title: 'Basic Greetings' },
    create: {
      chapterId: chapter.id,
      title: 'Basic Greetings',
      order: 1,
    },
  });

  const exercises = [
    {
      order: 1,
      type: 'MULTIPLE_CHOICE',
      question: {
        prompt: 'What does "matur nuwun" mean?',
        options: [
          { id: 'a', text: 'Good morning' },
          { id: 'b', text: 'Thank you' },
          { id: 'c', text: 'Goodbye' },
        ],
      },
      answer: { correctOptionId: 'b' },
    },
    {
      order: 2,
      type: 'MULTIPLE_CHOICE',
      question: {
        prompt: 'What does "sugeng enjing" mean?',
        options: [
          { id: 'a', text: 'Good night' },
          { id: 'b', text: 'Good afternoon' },
          { id: 'c', text: 'Good morning' },
        ],
      },
      answer: { correctOptionId: 'c' },
    },
    {
      order: 3,
      type: 'TRANSLATION',
      question: {
        prompt: 'Translate to English',
        text: 'Matur nuwun',
      },
      answer: {
        acceptedAnswers: ['thank you', 'thanks'],
      },
    },
    {
      order: 4,
      type: 'TRANSLATION',
      question: {
        prompt: 'Translate to Javanese',
        text: 'Good morning',
      },
      answer: {
        acceptedAnswers: ['sugeng enjing'],
      },
    },
    {
      order: 5,
      type: 'WORD_ORDER',
      question: {
        prompt: 'Arrange the words to say "Thank you"',
        tokens: [
          { id: 't1', text: 'nuwun' },
          { id: 't2', text: 'matur' },
        ],
      },
      answer: {
        correctTokenIds: ['t2', 't1'],
      },
    },
    {
      order: 6,
      type: 'WORD_ORDER',
      question: {
        prompt: 'Arrange the words to say "Good morning"',
        tokens: [
          { id: 't1', text: 'enjing' },
          { id: 't2', text: 'sugeng' },
        ],
      },
      answer: {
        correctTokenIds: ['t2', 't1'],
      },
    },
    {
      order: 7,
      type: 'FILL_BLANK',
      question: {
        prompt: 'Complete the Javanese phrase for "Thank you"',
        sentence: 'Matur ____',
      },
      answer: {
        acceptedAnswers: ['nuwun'],
      },
    },
    {
      order: 8,
      type: 'FILL_BLANK',
      question: {
        prompt: 'Complete the Javanese phrase for "Good morning"',
        sentence: 'Sugeng ____',
      },
      answer: {
        acceptedAnswers: ['enjing'],
      },
    },
    {
      order: 9,
      type: 'MATCHING',
      question: {
        prompt: 'Match each phrase with its meaning',
        left: [
          { id: 'l1', text: 'Matur nuwun' },
          { id: 'l2', text: 'Sugeng enjing' },
        ],
        right: [
          { id: 'r1', text: 'Good morning' },
          { id: 'r2', text: 'Thank you' },
        ],
      },
      answer: {
        pairs: [
          { leftId: 'l1', rightId: 'r2' },
          { leftId: 'l2', rightId: 'r1' },
        ],
      },
    },
    {
      order: 10,
      type: 'MATCHING',
      question: {
        prompt: 'Match each Javanese word with its meaning',
        left: [
          { id: 'l1', text: 'Inggih' },
          { id: 'l2', text: 'Mboten' },
        ],
        right: [
          { id: 'r1', text: 'No' },
          { id: 'r2', text: 'Yes' },
        ],
      },
      answer: {
        pairs: [
          { leftId: 'l1', rightId: 'r2' },
          { leftId: 'l2', rightId: 'r1' },
        ],
      },
    },
  ] as const;

  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: {
        lessonId_order: {
          lessonId: lesson.id,
          order: exercise.order,
        },
      },
      update: {
        type: exercise.type,
        question: exercise.question,
        answer: exercise.answer,
      },
      create: {
        lessonId: lesson.id,
        order: exercise.order,
        type: exercise.type,
        question: exercise.question,
        answer: exercise.answer,
      },
    });
  }

  const exerciseCount = await prisma.exercise.count({
    where: { lessonId: lesson.id },
  });

  if (exerciseCount !== 10) {
    throw new Error(`Lesson '${lesson.title}' must contain exactly 10 exercises`);
  }
}

try {
  await seedAchievements();
  await seedLanguages();
  await seedLearning();
} finally {
  await prisma.$disconnect();
}
