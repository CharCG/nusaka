const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function elapsedUtcDays(from: Date, to: Date): number {
  return Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS);
}

export function previousUtcDay(date: Date): Date {
  return new Date(utcDay(date).getTime() - DAY_MS);
}
