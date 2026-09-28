export function isPollClosed(
  expiresAt: Date | string | null,
  now: number,
): boolean {
  if (expiresAt === null) return false;
  const time = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  if (Number.isNaN(time)) return false;
  return time <= now;
}

const DAY_SECONDS = 86_400;
const THIRTY_DAYS_SECONDS = 30 * DAY_SECONDS;

export function ballotTtlSeconds(expiresAt: Date | null, now = Date.now()): number {
  if (!expiresAt) return THIRTY_DAYS_SECONDS;
  const untilExpiry = Math.ceil((expiresAt.getTime() - now) / 1000);
  return Math.max(60, untilExpiry + DAY_SECONDS);
}
