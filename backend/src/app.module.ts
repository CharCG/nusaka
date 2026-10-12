import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { LanguagesModule } from './modules/learning/languages/languages.module.js';
import { LessonAttemptsModule } from './modules/learning/lesson-attempts/lesson-attempts.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { envSchema } from './config/env.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envSchema,
    }),
    PrismaModule,
    AuthModule,
    LanguagesModule,
    LessonAttemptsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
