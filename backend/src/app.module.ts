import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module.js';
import { envSchema } from './config/env.config.js';
import { UsersModule } from './modules/users/users.module.js';
import { LanguagesModule } from './modules/learning/languages/languages.module.js';
import { LessonsModule } from './modules/learning/lessons/lessons.module.js';
import { LivesModule } from './modules/lives/lives.module.js';
import { StreaksModule } from './modules/streaks/streaks.module.js';
import { VocabulariesModule } from './modules/learning/vocabularies/vocabularies.module.js';
import { StoriesModule } from './modules/learning/stories/stories.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envSchema,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    LanguagesModule,
    LessonsModule,
    LivesModule,
    StreaksModule,
    VocabulariesModule,
    StoriesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
