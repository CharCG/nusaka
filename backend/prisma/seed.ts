import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function multipleChoice(prompt: string, options: [string, string, string, string], correctIndex: 0 | 1 | 2 | 3) {
  const optionIds = ['a', 'b', 'c', 'd'];

  return {
    type: 'MULTIPLE_CHOICE' as const,
    question: {
      prompt,
      options: options.map((text, index) => ({ id: optionIds[index], text })),
    },
    answer: { correctOptionId: optionIds[correctIndex] },
  };
}

function translation(text: string, acceptedAnswers: string[]) {
  return {
    type: 'TRANSLATION' as const,
    question: { prompt: 'Translate to English', text },
    answer: { acceptedAnswers },
  };
}

function wordOrder(prompt: string, words: string[]) {
  const tokens = words.map((text, index) => ({ id: `t${index + 1}`, text }));

  return {
    type: 'WORD_ORDER' as const,
    question: { prompt, tokens: [...tokens].reverse() },
    answer: { correctTokenIds: tokens.map((token) => token.id) },
  };
}

function fillBlank(prompt: string, sentence: string, acceptedAnswers: string[]) {
  return {
    type: 'FILL_BLANK' as const,
    question: { prompt, sentence },
    answer: { acceptedAnswers },
  };
}

function matching(pairs: [string, string][]) {
  return {
    type: 'MATCHING' as const,
    question: {
      prompt: 'Match each Javanese word with its English meaning',
      left: pairs.map(([text], index) => ({ id: `l${index + 1}`, text })),
      right: pairs.map(([, text], index) => ({ id: `r${index + 1}`, text })).reverse(),
    },
    answer: {
      pairs: pairs.map((_, index) => ({
        leftId: `l${index + 1}`,
        rightId: `r${index + 1}`,
      })),
    },
  };
}

async function seedAchievements() {
  await prisma.achievement.upsert({
    where: { code: 'FIRST_STEP' },
    update: {
      name: 'First Step',
      description: 'Create your account',
    },
    create: {
      code: 'FIRST_STEP',
      name: 'First Step',
      description: 'Create your account',
    },
  });
}

async function seedLanguages() {
  const languages = [
    { code: 'jav', name: 'Java' },
    { code: 'sun', name: 'Sunda' },
  ];

  for (const language of languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: { name: language.name },
      create: language,
    });
  }
}

async function seedLessons() {
  const language = await prisma.language.findUnique({
    where: { code: 'jav' },
    select: { id: true },
  });

  if (!language) {
    throw new Error("Language 'jav' not found");
  }

  const lesson1 = {
    title: 'Basic Greetings',
    exercises: [
      multipleChoice('What does "sugeng enjing" mean?', ['Good morning', 'Thank you', 'Goodbye', 'Good night'], 0),
      translation('Sugeng dalu', ['good night']),
      wordOrder('Arrange the words to say "Good morning"', ['Sugeng', 'enjing']),
    ],
  };

  const lesson2 = {
    title: 'Saying Goodbye',
    exercises: [
      multipleChoice(
        'What does "pamit" mean?',
        ['Saying thank you', 'Taking leave', 'Introducing yourself', 'Asking for help'],
        1,
      ),
      translation('Aku pamit', ['i am taking leave', "i'm taking leave"]),
      wordOrder('Arrange the words to say "I am taking leave"', ['Aku', 'pamit']),
    ],
  };

  const lesson3 = {
    title: 'Asking How Someone Is',
    exercises: [
      multipleChoice(
        'What does "piye kabarmu?" mean?',
        ['What is your name?', 'Where are you from?', 'How are you?', 'How old are you?'],
        2,
      ),
      translation('Apik', ['good']),
      fillBlank('Complete the question "How are you?"', 'Piye ____?', ['kabarmu']),
    ],
  };

  const lesson4 = {
    title: 'Introducing Yourself',
    exercises: [
      multipleChoice(
        'What does "jenengku Budi" mean?',
        ['My name is Budi', 'I am from Solo', 'How are you?', 'Good morning'],
        0,
      ),
      translation('Aku Budi', ['i am budi', "i'm budi"]),
      wordOrder('Arrange the words to say "My name is Budi"', ['Jenengku', 'Budi']),
    ],
  };

  const lesson5 = {
    title: "Asking Someone's Name",
    exercises: [
      multipleChoice(
        'What does "sapa jenengmu?" mean?',
        ['How are you?', 'What is your name?', 'Good morning', 'Where are you from?'],
        1,
      ),
      translation('Jeneng', ['name']),
      fillBlank('Complete the question "What is your name?"', 'Sapa ____?', ['jenengmu']),
    ],
  };

  const lesson6 = {
    title: 'Where Are You From?',
    exercises: [
      multipleChoice(
        'What does "aku saka Solo" mean?',
        ['My name is Solo', 'I am fine', 'I am from Solo', 'I am taking leave'],
        2,
      ),
      translation('Saka', ['from']),
      wordOrder('Arrange the words to say "I am from Solo"', ['Aku', 'saka', 'Solo']),
    ],
  };

  const lesson7 = {
    title: 'Number 1-10',
    exercises: [
      multipleChoice('What number is "siji"?', ['One', 'Two', 'Three', 'Four'], 0),
      translation('Loro', ['two', '2']),
      matching([
        ['Siji', 'One'],
        ['Loro', 'Two'],
        ['Telu', 'Three'],
      ]),
    ],
  };

  const lesson8 = {
    title: 'Number 11-20',
    exercises: [
      multipleChoice('What number is "sewelas"?', ['Twelve', 'Eleven', 'Twenty', 'Ten'], 1),
      translation('Rolas', ['twelve', '12']),
      matching([
        ['Sewelas', 'Eleven'],
        ['Rolas', 'Twelve'],
        ['Rong puluh', 'Twenty'],
      ]),
    ],
  };

  const lesson9 = {
    title: 'Tens and Hundreds',
    exercises: [
      multipleChoice('What number is "sepuluh"?', ['Twenty', 'One hundred', 'Ten', 'Thirty'], 2),
      translation('Satus', ['one hundred', 'a hundred', 'hundred', '100']),
      matching([
        ['Sepuluh', 'Ten'],
        ['Rong puluh', 'Twenty'],
        ['Satus', 'One hundred'],
      ]),
    ],
  };

  const units = [
    {
      title: 'Basics',
      chapters: [
        {
          title: 'Greetings',
          lessons: [lesson1, lesson2, lesson3],
        },
        {
          title: 'Introductions',
          lessons: [lesson4, lesson5, lesson6],
        },
      ],
    },
    {
      title: 'Everyday',
      chapters: [{ title: 'Numbers', lessons: [lesson7, lesson8, lesson9] }],
    },
  ];

  for (const [unitIndex, unitData] of units.entries()) {
    const unit = await prisma.unit.upsert({
      where: { languageId_order: { languageId: language.id, order: unitIndex + 1 } },
      update: { title: unitData.title },
      create: { languageId: language.id, order: unitIndex + 1, title: unitData.title },
    });

    for (const [chapterIndex, chapterData] of unitData.chapters.entries()) {
      const chapter = await prisma.chapter.upsert({
        where: { unitId_order: { unitId: unit.id, order: chapterIndex + 1 } },
        update: { title: chapterData.title },
        create: { unitId: unit.id, order: chapterIndex + 1, title: chapterData.title },
      });

      for (const [lessonIndex, lessonData] of chapterData.lessons.entries()) {
        const lesson = await prisma.lesson.upsert({
          where: { chapterId_order: { chapterId: chapter.id, order: lessonIndex + 1 } },
          update: { title: lessonData.title },
          create: { chapterId: chapter.id, order: lessonIndex + 1, title: lessonData.title },
        });

        for (const [exerciseIndex, exerciseData] of lessonData.exercises.entries()) {
          await prisma.exercise.upsert({
            where: { lessonId_order: { lessonId: lesson.id, order: exerciseIndex + 1 } },
            update: exerciseData,
            create: { lessonId: lesson.id, order: exerciseIndex + 1, ...exerciseData },
          });
        }
      }
    }
  }
}

async function seedStories() {
  const language = await prisma.language.findUnique({
    where: { code: 'jav' },
    select: { id: true },
  });

  if (!language) {
    throw new Error("Language 'jav' not found");
  }

  const story = await prisma.story.upsert({
    where: { id: '8c17f03a-9241-4e8d-a6d4-000000000001' },
    update: {
      languageId: language.id,
      title: 'Nara and the Quiet Garden',
      description: 'An original story about a village garden, a small discovery, and the courage to speak up.',
    },
    create: {
      id: '8c17f03a-9241-4e8d-a6d4-000000000001',
      languageId: language.id,
      title: 'Nara and the Quiet Garden',
      description: 'An original story about a village garden, a small discovery, and the courage to speak up.',
    },
  });

  const storyPages: string[] = [
    'Every afternoon, Nara helped her grandfather in the village garden. One day, he gave her a jar of wiji, seeds saved from the last harvest. Nara planted them beside the old bench and drew a little map so she would remember where each row began. But after several hot days, the soil grew dry. Even the watering channel beside the garden had become strangely quiet.',
    'Nara asked her grandmother to follow the channel with her. Together they walked to the edge of the alas, where tall trees shaded the path. Near a bend, Nara heard a faint splash. Fallen branches had blocked the channel, sending its banyu, water, into a shallow pool instead of toward the garden. Her grandmother smiled at the discovery. They left the heavy branches alone and went home to ask the neighbors for help.',
    'That evening, the neighbors gathered beside the old bench. Nara usually listened quietly, but she chose to be wani, brave, and show them her map. The next morning, several adults cleared the blockage while Nara and the other children tidied the garden paths. Soon banyu flowed along the channel again. Nara stayed beside her seedlings, listening to the sound that had been missing.',
    'Weeks later, the first vegetables were ready. The neighbors made a pot of soup, and Grandfather added a small pinch of uyah, salt, before everyone shared a meal beside the garden. Nara saved a few wiji in her jar for the next planting. On its lid she wrote a reminder: small things grow when people care for them together. This time, she added the watering channel to her map.',
  ];

  for (const [index, content] of storyPages.entries()) {
    const order = index + 1;

    await prisma.storyPage.upsert({
      where: {
        storyId_order: {
          storyId: story.id,
          order,
        },
      },
      update: { content },
      create: {
        storyId: story.id,
        order,
        content,
      },
    });
  }
}

async function main() {
  try {
    await seedAchievements();
    await seedLanguages();
    await seedLessons();
    await seedStories();
  } finally {
    await prisma.$disconnect();
  }
}

await main();
