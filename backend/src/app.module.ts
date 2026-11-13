import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { LanguagesModule } from './modules/learning/languages/languages.module.js';
import { LessonsModule } from './modules/learning/lessons/lessons.module.js';
import { StoriesModule } from './modules/learning/stories/stories.module.js';
import { envSchema } from './config/env.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (env) => envSchema.parse(env),
    }),
    PrismaModule,
    AuthModule,
    MailModule,
    UsersModule,
    LanguagesModule,
    LessonsModule,
    StoriesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
