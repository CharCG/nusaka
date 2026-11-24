import { QuestPeriod } from '../../generated/prisma/client.js';
import { DAY_MS, WEEK_MS, utcDay, utcWeek } from '../../common/utils/day.util.js';

export function getQuestPeriod(period: QuestPeriod, now: Date) {
  if (period === QuestPeriod.DAILY) {
    const start = utcDay(now);
    
    return {
      start,
      end: new Date(start.getTime() + DAY_MS),
    };
  }

  const start = utcWeek(now);

  return {
    start,
    end: new Date(start.getTime() + WEEK_MS),
  };
}
