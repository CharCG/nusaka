import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { LIVES_DAILY_REGENERATION, LIVES_DAILY_REGENERATION_MAX } from './lives.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class LivesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LivesService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onApplicationBootstrap() {
    await this.regenerateDailyLives();
  }

  @Cron('0 0 * * * *', {
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async regenerateDailyLives() {
    try {
      const processedUsers = await this.prismaService.$executeRaw`
        UPDATE "UserStats"
        SET
          "lives" = CASE
            WHEN "lives" >= ${LIVES_DAILY_REGENERATION_MAX} THEN "lives"
            ELSE LEAST(
              ${LIVES_DAILY_REGENERATION_MAX},
              "lives" + ${LIVES_DAILY_REGENERATION} * (
                (NOW() AT TIME ZONE 'UTC')::date - ("lastLivesRegenAt" AT TIME ZONE 'UTC')::date
              )
            )
          END,
          "lastLivesRegenAt" = NOW()
        WHERE
          ("lastLivesRegenAt" AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE 'UTC')::date
      `;

      if (processedUsers > 0) {
        this.logger.log(`Lives regeneration processed ${processedUsers} users`);
      }
    } catch (error) {
      this.logger.error(
        'Lives regeneration failed, the next scheduled run will retry',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    }
  }
}
