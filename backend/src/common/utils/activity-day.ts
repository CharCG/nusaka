const DAY_MS = 24 * 60 * 60 * 1000;

export function getActivityDayIndex(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}
