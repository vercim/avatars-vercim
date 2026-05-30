/**
 * Lightweight, client-side search throttling backed by localStorage.
 *
 * Two independent limits are enforced:
 *  - a 15s cooldown between consecutive searches, and
 *  - a rolling cap of 30 searches per hour.
 *
 * This is intentionally not a security control — it only gives honest users
 * clear feedback. All functions are pure with respect to their inputs and
 * never mutate stored arrays in place.
 */

const STORAGE_KEY = 'avatars:search-history';
export const HOURLY_LIMIT = 30;
export const COOLDOWN_MS = 15_000;
const HOUR_MS = 60 * 60 * 1000;

export interface SearchStatus {
  allowed: boolean;
  /** Milliseconds until the next search is allowed (0 when allowed). */
  waitMs: number;
  /** True when blocked by the hourly cap rather than the short cooldown. */
  hourlyLimited: boolean;
}

/** Read the stored search timestamps, pruned to the last hour. */
function readHistory(now: number): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is number => typeof t === 'number' && now - t < HOUR_MS,
    );
  } catch {
    // localStorage unavailable or corrupt — fail open with no history.
    return [];
  }
}

function writeHistory(history: readonly number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore quota / privacy-mode errors; throttling is best-effort.
  }
}

/** Current throttle status. Pure read — does not record a search. */
export function getSearchStatus(now: number = Date.now()): SearchStatus {
  const history = readHistory(now);

  if (history.length > 0) {
    const last = Math.max(...history);
    const cooldownLeft = COOLDOWN_MS - (now - last);
    if (cooldownLeft > 0) {
      return { allowed: false, waitMs: cooldownLeft, hourlyLimited: false };
    }
  }

  if (history.length >= HOURLY_LIMIT) {
    const oldest = Math.min(...history);
    const hourlyLeft = oldest + HOUR_MS - now;
    if (hourlyLeft > 0) {
      return { allowed: false, waitMs: hourlyLeft, hourlyLimited: true };
    }
  }

  return { allowed: true, waitMs: 0, hourlyLimited: false };
}

/** Record that a search just happened, pruning entries older than an hour. */
export function recordSearch(now: number = Date.now()): void {
  const history = readHistory(now);
  writeHistory([...history, now]);
}
