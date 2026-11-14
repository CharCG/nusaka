import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ENERGY_DAILY_RESTORE, ENERGY_DAILY_RESTORE_CAP, ENERGY_RESTORE_CRON } from './energies.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class EnergiesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EnergiesService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onApplicationBootstrap() {
    await this.restoreDailyEnergy();
  }

  @Cron(ENERGY_RESTORE_CRON, {
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async restoreDailyEnergy() {
    try {
      const processedUsers = await this.prismaService.$executeRaw`
        UPDATE "UserStats"
        SET
          "energy" = CASE
            WHEN "energy" >= ${ENERGY_DAILY_RESTORE_CAP}
              THEN "energy"
            ELSE LEAST(
              ${ENERGY_DAILY_RESTORE_CAP},
              "energy" + ${ENERGY_DAILY_RESTORE} * (
                (NOW() AT TIME ZONE 'UTC')::date
                - ("lastEnergyRestoredAt" AT TIME ZONE 'UTC')::date
              )
            )
          END,
          "lastEnergyRestoredAt" = NOW()
        WHERE "lastEnergyRestoredAt" < (
          date_trunc('day', NOW() AT TIME ZONE 'UTC')
          AT TIME ZONE 'UTC'
        )
      `;

      if (processedUsers > 0) {
        this.logger.log(`Daily energy processed ${processedUsers} users`);
      }
    } catch (error) {
      this.logger.error(
        'Unable to restore daily energy. The next scheduled run will retry',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    }
  }
}
