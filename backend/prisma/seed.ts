import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DIRECT_URL;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
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

try {
  await main();
} finally {
  await prisma.$disconnect();
}
