import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type ExerciseType, type Prisma } from '../src/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type SeedExercise = {
  type: ExerciseType;
  question: Prisma.InputJsonObject;
  answer: Prisma.InputJsonObject;
};

type SeedLesson = {
  title: string;
  exercises: [SeedExercise, SeedExercise, SeedExercise];
};

function multipleChoice(prompt: string, options: [string, string, string], correctIndex: 0 | 1 | 2): SeedExercise {
  const optionIds = ['a', 'b', 'c'];

  return {
    type: 'MULTIPLE_CHOICE',
    question: {
      prompt,
      options: options.map((text, index) => ({ id: optionIds[index], text })),
    },
    answer: { correctOptionId: optionIds[correctIndex] },
  };
}

function translation(text: string, acceptedAnswers: string[]): SeedExercise {
  return {
    type: 'TRANSLATION',
    question: { prompt: 'Translate to English', text },
    answer: { acceptedAnswers },
  };
}

function wordOrder(prompt: string, words: string[]): SeedExercise {
  const tokens = words.map((text, index) => ({ id: `t${index + 1}`, text }));

  return {
    type: 'WORD_ORDER',
    question: { prompt, tokens: [...tokens].reverse() },
    answer: { correctTokenIds: tokens.map((token) => token.id) },
  };
}

function fillBlank(prompt: string, sentence: string, acceptedAnswers: string[]): SeedExercise {
  return {
    type: 'FILL_BLANK',
    question: { prompt, sentence },
    answer: { acceptedAnswers },
  };
}

function matching(pairs: [string, string][]): SeedExercise {
  return {
    type: 'MATCHING',
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

const lesson1: SeedLesson = {
  title: 'Basic Greetings',
  exercises: [
    multipleChoice('What does "sugeng enjing" mean?', ['Good morning', 'Thank you', 'Goodbye'], 0),
    translation('Sugeng dalu', ['good night']),
    wordOrder('Arrange the words to say "Good morning"', ['Sugeng', 'enjing']),
  ],
};

const lesson2: SeedLesson = {
  title: 'Saying Goodbye',
  exercises: [
    multipleChoice('What does "pamit" mean?', ['Saying thank you', 'Taking leave', 'Introducing yourself'], 1),
    translation('Aku pamit', ['i am taking leave', "i'm taking leave"]),
    wordOrder('Arrange the words to say "I am taking leave"', ['Aku', 'pamit']),
  ],
};

const lesson3: SeedLesson = {
  title: 'Asking How Someone Is',
  exercises: [
    multipleChoice('What does "piye kabarmu?" mean?', ['What is your name?', 'Where are you from?', 'How are you?'], 2),
    translation('Apik', ['good']),
    fillBlank('Complete the question "How are you?"', 'Piye ____?', ['kabarmu']),
  ],
};

const lesson4: SeedLesson = {
  title: 'Introducing Yourself',
  exercises: [
    multipleChoice('What does "jenengku Budi" mean?', ['My name is Budi', 'I am from Solo', 'How are you?'], 0),
    translation('Aku Budi', ['i am budi', "i'm budi"]),
    wordOrder('Arrange the words to say "My name is Budi"', ['Jenengku', 'Budi']),
  ],
};

const lesson5: SeedLesson = {
  title: "Asking Someone's Name",
  exercises: [
    multipleChoice('What does "sapa jenengmu?" mean?', ['How are you?', 'What is your name?', 'Good morning'], 1),
    translation('Jeneng', ['name']),
    fillBlank('Complete the question "What is your name?"', 'Sapa ____?', ['jenengmu']),
  ],
};

const lesson6: SeedLesson = {
  title: 'Where Are You From?',
  exercises: [
    multipleChoice('What does "aku saka Solo" mean?', ['My name is Solo', 'I am fine', 'I am from Solo'], 2),
    translation('Saka', ['from']),
    wordOrder('Arrange the words to say "I am from Solo"', ['Aku', 'saka', 'Solo']),
  ],
};

const lesson7: SeedLesson = {
  title: 'Saying Thank You',
  exercises: [
    multipleChoice('What does "matur nuwun" mean?', ['Thank you', 'Good morning', 'No'], 0),
    translation('Matur nuwun', ['thank you', 'thanks']),
    fillBlank('Complete the phrase "Thank you"', 'Matur ____', ['nuwun']),
  ],
};

const lesson8: SeedLesson = {
  title: 'Saying Sorry',
  exercises: [
    multipleChoice('What does "nyuwun pangapunten" express?', ['Gratitude', 'An apology', 'A greeting'], 1),
    translation('Ngapura', ['forgive']),
    wordOrder('Arrange the words to express an apology', ['Nyuwun', 'pangapunten']),
  ],
};

const lesson9: SeedLesson = {
  title: 'Yes and No',
  exercises: [
    multipleChoice('What does "inggih" mean?', ['No', 'Thank you', 'Yes'], 2),
    translation('Mboten', ['no']),
    matching([
      ['Inggih', 'Yes'],
      ['Mboten', 'No'],
    ]),
  ],
};

const lesson10: SeedLesson = {
  title: 'Number 1-10',
  exercises: [
    multipleChoice('What number is "siji"?', ['One', 'Two', 'Three'], 0),
    translation('Loro', ['two', '2']),
    matching([
      ['Siji', 'One'],
      ['Loro', 'Two'],
      ['Telu', 'Three'],
    ]),
  ],
};

const lesson11: SeedLesson = {
  title: 'Number 11-20',
  exercises: [
    multipleChoice('What number is "sewelas"?', ['Twelve', 'Eleven', 'Twenty'], 1),
    translation('Rolas', ['twelve', '12']),
    matching([
      ['Sewelas', 'Eleven'],
      ['Rolas', 'Twelve'],
      ['Rong puluh', 'Twenty'],
    ]),
  ],
};

const lesson12: SeedLesson = {
  title: 'Tens and Hundreds',
  exercises: [
    multipleChoice('What number is "sepuluh"?', ['Twenty', 'One hundred', 'Ten'], 2),
    translation('Satus', ['one hundred', 'a hundred', 'hundred', '100']),
    matching([
      ['Sepuluh', 'Ten'],
      ['Rong puluh', 'Twenty'],
      ['Satus', 'One hundred'],
    ]),
  ],
};

const lesson13: SeedLesson = {
  title: 'Basic Colors',
  exercises: [
    multipleChoice('What color is "abang"?', ['Red', 'Blue', 'Green'], 0),
    translation('Ijo', ['green']),
    matching([
      ['Abang', 'Red'],
      ['Biru', 'Blue'],
      ['Ijo', 'Green'],
    ]),
  ],
};

const lesson14: SeedLesson = {
  title: 'Everyday Objects',
  exercises: [
    multipleChoice('What does "buku" mean?', ['Table', 'Book', 'Chair'], 1),
    translation('Meja', ['table']),
    matching([
      ['Buku', 'Book'],
      ['Meja', 'Table'],
      ['Kursi', 'Chair'],
    ]),
  ],
};

const lesson15: SeedLesson = {
  title: 'Describing Objects',
  exercises: [
    multipleChoice('What does "gedhe" mean?', ['Small', 'Long', 'Big'], 2),
    translation('Cilik', ['small']),
    matching([
      ['Gedhe', 'Big'],
      ['Cilik', 'Small'],
      ['Dawa', 'Long'],
    ]),
  ],
};

const learningUnits = [
  {
    title: 'Basics',
    chapters: [
      { title: 'Greetings', lessons: [lesson1, lesson2, lesson3] },
      { title: 'Introductions', lessons: [lesson4, lesson5, lesson6] },
      { title: 'Expressions', lessons: [lesson7, lesson8, lesson9] },
    ],
  },
  {
    title: 'Everyday',
    chapters: [
      { title: 'Numbers', lessons: [lesson10, lesson11, lesson12] },
      { title: 'Colors and Objects', lessons: [lesson13, lesson14, lesson15] },
    ],
  },
];

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
    { code: 'jav', name: 'Java' },
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
    throw new Error("Language 'jav' not found");
  }

  for (const [unitIndex, unitData] of learningUnits.entries()) {
    const unitOrder = unitIndex + 1;
    const unit = await prisma.unit.upsert({
      where: {
        languageId_order: { languageId: language.id, order: unitOrder },
      },
      update: { title: unitData.title },
      create: {
        languageId: language.id,
        title: unitData.title,
        order: unitOrder,
      },
    });

    for (const [chapterIndex, chapterData] of unitData.chapters.entries()) {
      const chapterOrder = chapterIndex + 1;
      const chapter = await prisma.chapter.upsert({
        where: {
          unitId_order: { unitId: unit.id, order: chapterOrder },
        },
        update: { title: chapterData.title },
        create: {
          unitId: unit.id,
          title: chapterData.title,
          order: chapterOrder,
        },
      });

      for (const [lessonIndex, lessonData] of chapterData.lessons.entries()) {
        const lessonOrder = lessonIndex + 1;
        const lesson = await prisma.lesson.upsert({
          where: {
            chapterId_order: { chapterId: chapter.id, order: lessonOrder },
          },
          update: { title: lessonData.title },
          create: {
            chapterId: chapter.id,
            title: lessonData.title,
            order: lessonOrder,
          },
        });

        for (const [exerciseIndex, exercise] of lessonData.exercises.entries()) {
          const exerciseOrder = exerciseIndex + 1;

          await prisma.exercise.upsert({
            where: {
              lessonId_order: { lessonId: lesson.id, order: exerciseOrder },
            },
            update: exercise,
            create: {
              lessonId: lesson.id,
              order: exerciseOrder,
              ...exercise,
            },
          });
        }

        await prisma.exercise.deleteMany({
          where: {
            lessonId: lesson.id,
            order: {
              notIn: lessonData.exercises.map((_, index) => index + 1),
            },
          },
        });
      }
    }
  }
}

async function seedStory() {
  const language = await prisma.language.findUnique({
    where: { code: 'jav' },
    select: { id: true },
  });

  if (!language) {
    throw new Error("Language 'jav' not found");
  }

  const vocabularyIds = {
    wiji: '8c17f03a-9241-4e8d-a6d4-000000000101',
    alas: '8c17f03a-9241-4e8d-a6d4-000000000102',
    banyu: '8c17f03a-9241-4e8d-a6d4-000000000103',
    uyah: '8c17f03a-9241-4e8d-a6d4-000000000104',
    wani: '8c17f03a-9241-4e8d-a6d4-000000000105',
  };

  // https://kbji.kemendikdasmen.go.id
  const vocabularies = [
    { id: vocabularyIds.wiji, word: 'wiji', meaning: 'seed', usageExample: 'wiji iki ditandur ing kebon.' },
    { id: vocabularyIds.alas, word: 'alas', meaning: 'forest', usageExample: 'aku mlaku ing alas.' },
    { id: vocabularyIds.banyu, word: 'banyu', meaning: 'water', usageExample: 'aku ngombe banyu.' },
    { id: vocabularyIds.uyah, word: 'uyah', meaning: 'salt', usageExample: 'ibu tuku uyah.' },
    { id: vocabularyIds.wani, word: 'wani', meaning: 'brave', usageExample: 'Nara wani.' },
  ];

  for (const { id, ...vocabulary } of vocabularies) {
    const data = { ...vocabulary, languageId: language.id };

    await prisma.vocabulary.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }

  const storyData = {
    languageId: language.id,
    title: 'Nara and the Quiet Garden',
    description: 'An original story about a village garden, a small discovery, and the courage to speak up.',
  };

  const story = await prisma.story.upsert({
    where: { id: '8c17f03a-9241-4e8d-a6d4-000000000001' },
    update: storyData,
    create: { id: '8c17f03a-9241-4e8d-a6d4-000000000001', ...storyData },
  });

  const pages: Prisma.InputJsonObject[] = [
    {
      segments: [
        { text: 'Every afternoon, Nara helped her grandfather in the village garden. One day, he gave her a jar of ' },
        { text: 'wiji', vocabularyId: vocabularyIds.wiji },
        { text: ', seeds saved from the last harvest. Nara planted them beside the old bench and drew a little map so she would remember where each row began. But after several hot days, the soil grew dry. Even the watering channel beside the garden had become strangely quiet.' },
      ],
    },
    {
      segments: [
        { text: 'Nara asked her grandmother to follow the channel with her. Together they walked to the edge of the ' },
        { text: 'alas', vocabularyId: vocabularyIds.alas },
        { text: ', where tall trees shaded the path. Near a bend, Nara heard a faint splash. Fallen branches had blocked the channel, sending its ' },
        { text: 'banyu', vocabularyId: vocabularyIds.banyu },
        { text: ', water, into a shallow pool instead of toward the garden. Her grandmother smiled at the discovery. They left the heavy branches alone and went home to ask the neighbors for help.' },
      ],
    },
    {
      segments: [
        { text: 'That evening, the neighbors gathered beside the old bench. Nara usually listened quietly, but she chose to be ' },
        { text: 'wani', vocabularyId: vocabularyIds.wani },
        { text: ', brave, and show them her map. The next morning, several adults cleared the blockage while Nara and the other children tidied the garden paths. Soon ' },
        { text: 'banyu', vocabularyId: vocabularyIds.banyu },
        { text: ' flowed along the channel again. Nara stayed beside her seedlings, listening to the sound that had been missing.' },
      ],
    },
    {
      segments: [
        { text: 'Weeks later, the first vegetables were ready. The neighbors made a pot of soup, and Grandfather added a small pinch of ' },
        { text: 'uyah', vocabularyId: vocabularyIds.uyah },
        { text: ', salt, before everyone shared a meal beside the garden. Nara saved a few ' },
        { text: 'wiji', vocabularyId: vocabularyIds.wiji },
        { text: ' in her jar for the next planting. On its lid she wrote a reminder: small things grow when people care for them together. This time, she added the watering channel to her map.' },
      ],
    },
  ];

  for (const [index, content] of pages.entries()) {
    const order = index + 1;

    await prisma.storyPage.upsert({
      where: { storyId_order: { storyId: story.id, order } },
      update: { content },
      create: { storyId: story.id, order, content },
    });
  }
}

async function main() {
  try {
    await seedAchievements();
    await seedLanguages();
    await seedLearning();
    await seedStory();
  } finally {
    await prisma.$disconnect();
  }
}

await main();
