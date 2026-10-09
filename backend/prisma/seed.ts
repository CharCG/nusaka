import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function achievements() {
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

async function languages() {
  const languages = [
    { code: 'jav', name: 'Jawa' },
    { code: 'sun', name: 'Sunda' },
    { code: 'mad', name: 'Madura' },
  ];

  for (const language of languages) {
    await prisma.language.upsert({
      where: {
        code: language.code,
      },
      update: {
        name: language.name,
      },
      create: language,
    });
  }
}

async function main() {
  await achievements();
  await languages();
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
