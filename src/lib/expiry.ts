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

export function formatPollTiming(expiresAt: string | null, now: number): string | null {
  if (expiresAt === null) return null;
  if (isPollClosed(expiresAt, now)) return "Closed";

  const remainingMs = Date.parse(expiresAt) - now;
  if (Number.isNaN(remainingMs)) return null;
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (minutes < 60) return `Closes in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest === 0 ? `Closes in ${hours}h` : `Closes in ${hours}h ${rest}m`;
  return `Closes in ${Math.floor(hours / 24)}d`;
}

export function ballotTtlSeconds(expiresAt: Date | null, now = Date.now()): number {
  if (!expiresAt) return THIRTY_DAYS_SECONDS;
  const untilExpiry = Math.ceil((expiresAt.getTime() - now) / 1000);
  return Math.max(60, untilExpiry + DAY_SECONDS);
}
