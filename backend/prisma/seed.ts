import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

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

async function main() {
  try {
    await seedAchievements();
  } finally {
    await prisma.$disconnect();
  }
}

await main();
