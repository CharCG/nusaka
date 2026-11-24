export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcWeek(date: Date): Date {
  const day = utcDay(date);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;

  return new Date(day.getTime() - daysSinceMonday * DAY_MS);
}
